#!/usr/bin/env node
// Dev container provisioning, run from postStartCommand. Idempotent.
//
// The laptop equivalent is `pnpm bootstrap`, which drives the same sequence
// through `docker compose`. Here the stack is already running (the dev
// container is one of its services), so this talks to it directly:
//   1. ensure .env exists, its secrets are generated, and — in a codespace —
//      it points at Compose hostnames and the forwarded https origins
//   2. ensure the identity database exists
//   3. migrate the dev, test and identity databases
//   4. boot the identity Worker (`pnpm dev:cf`) and seed it: the app's OIDC
//      client and the admin, recorded in the app database as a super-admin
//   5. publish port 3002, without which the OIDC back channel can't reach it

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { startCfDev } from "./lib/cf-dev.mjs";
import { readEnv, updateEnv } from "./lib/env-file.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");

const IDENTITY_PORT = 3002;
const IDENTITY_DATABASE = "effect-monorepo-identity";
const CF_DEV_BOOT_TIMEOUT_MS = 180_000;

const randomHex = (bytes) => randomBytes(bytes).toString("hex");
const isBlank = (value) => value === undefined || value.length === 0;

function ensureEnvFile() {
  if (existsSync(ENV_PATH)) return;
  copyFileSync(ENV_EXAMPLE, ENV_PATH);
  chmodSync(ENV_PATH, 0o600);
}

function ensureSecrets() {
  const env = readEnv(ENV_PATH);
  const missing = ["SESSION_COOKIE_SECRET", "BETTER_AUTH_SECRET"].filter((name) =>
    isBlank(env[name]),
  );
  updateEnv(ENV_PATH, Object.fromEntries(missing.map((name) => [name, randomHex(32)])));
}

// The template's well-known credentials would be an open door once port 3002
// is public, so each codespace gets its own.
function replaceTemplateCredentials() {
  const env = readEnv(ENV_PATH);
  const example = readEnv(ENV_EXAMPLE);
  const generated = {
    IDENTITY_SEED_TOKEN: randomHex(32),
    IDENTITY_CLIENT_SECRET: randomHex(32),
    IDENTITY_ADMIN_PASSWORD: `Cs!${randomHex(12)}aA1`,
  };
  const stale = Object.keys(generated).filter(
    (name) => isBlank(env[name]) || env[name] === example[name],
  );
  updateEnv(ENV_PATH, Object.fromEntries(stale.map((name) => [name, generated[name]])));
}

function pinEnvToCodespace(codespaceName) {
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
  const forwarded = (port) => `https://${codespaceName}-${port}.${domain}`;
  const webOrigin = forwarded(3000);
  const identityOrigin = forwarded(IDENTITY_PORT);
  const postgres = (database) => `postgresql://postgres:postgres@postgres:5432/${database}`;

  updateEnv(ENV_PATH, {
    // Service names, not localhost: the dev container is on the Compose network.
    DATABASE_URL: postgres("effect-monorepo"),
    DATABASE_URL_TEST: postgres("effect-monorepo-test"),
    IDENTITY_DATABASE_URL: postgres(IDENTITY_DATABASE),
    OTLP_URL: "http://jaeger:4318/v1/traces",
    MAIL_SMTP_HOST: "mailpit",

    APP_URL: webOrigin,
    SERVER_INTERNAL_URL: "http://localhost:3001",
    NEXT_PUBLIC_OTLP_URL: `${forwarded(4318)}/v1/traces`,

    IDENTITY_BASE_URL: identityOrigin,
    IDENTITY_ISSUER: `${identityOrigin}/api/auth`,
    IDENTITY_REDIRECT_URI: `${webOrigin}/api/auth/callback`,
    IDENTITY_POST_LOGOUT_REDIRECT_URI: `${webOrigin}/`,
  });
  replaceTemplateCredentials();
  return { webOrigin, identityOrigin };
}

// `pnpm dev:cf` points the identity Hyperdrive at this database. Created here
// rather than by a postgres init script, which only runs on a fresh volume.
async function ensureIdentityDatabase() {
  const client = new pg.Client({ connectionString: readEnv(ENV_PATH).DATABASE_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      IDENTITY_DATABASE,
    ]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${IDENTITY_DATABASE}"`);
  } finally {
    await client.end();
  }
}

function migrate() {
  for (const args of [["db:migrate"], ["--filter", "@org/database", "db:migrate:test"]]) {
    const result = spawnSync("pnpm", args, { cwd: ROOT, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`pnpm ${args.join(" ")} failed`);
  }
}

// The server validates that the issuer it discovers equals IDENTITY_ISSUER, so
// its back channel has to reach the Worker at the forwarded URL the browser
// uses. A private forwarded port answers a server-to-server call with GitHub's
// auth wall.
async function publishIdentityPort(codespaceName) {
  // Codespaces registers a forwarded port a little after the listener appears,
  // and until it does this fails with `error getting tunnel port: 404`.
  const deadline = Date.now() + 60_000;
  let lastError = "";
  while (Date.now() < deadline) {
    const result = spawnSync(
      "gh",
      ["codespace", "ports", "visibility", `${IDENTITY_PORT}:public`, "-c", codespaceName],
      { encoding: "utf8" },
    );
    if (result.status === 0) return true;
    lastError = `${result.stderr ?? ""}`.trim();
    await sleep(5_000);
  }
  console.error(`  publishing port ${IDENTITY_PORT} kept failing — last: ${lastError}`);
  return false;
}

// The identity Worker only runs under `alchemy dev`, so it is up just long
// enough to seed it and, while it listens, publish its port.
async function seedIdentity(codespaceName) {
  const dev = startCfDev(ROOT);
  try {
    const identityUrl = await dev.waitForOutput("identityUrl", CF_DEV_BOOT_TIMEOUT_MS);
    if (identityUrl === undefined) {
      throw new Error(`pnpm dev:cf never reported the identity Worker.\n${dev.output()}`);
    }
    // Seeded over loopback, so it does not wait on the port's visibility.
    const result = spawnSync("pnpm", ["seed:identity"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, IDENTITY_ISSUER: `http://localhost:${IDENTITY_PORT}/api/auth` },
    });
    if (result.status !== 0) throw new Error("pnpm seed:identity failed");
    return codespaceName === undefined ? true : await publishIdentityPort(codespaceName);
  } finally {
    dev.stop();
  }
}

async function main() {
  const codespaceName = process.env.CODESPACE_NAME;

  ensureEnvFile();
  ensureSecrets();
  if (codespaceName === undefined) {
    console.log("Not a codespace — leaving .env on its localhost defaults.");
  } else {
    const { webOrigin, identityOrigin } = pinEnvToCodespace(codespaceName);
    console.log(`.env pinned to ${codespaceName} (web ${webOrigin}, identity ${identityOrigin})`);
  }

  await ensureIdentityDatabase();
  migrate();
  const published = await seedIdentity(codespaceName);

  const env = readEnv(ENV_PATH);
  console.log(`
Dev environment ready.

  pnpm dev        web on :3000, BFF on :3001, identity Worker on :${IDENTITY_PORT}
  Sign in         ${env.APP_URL ?? "http://localhost:3000"}/api/auth/login
  Credentials     ${env.IDENTITY_ADMIN_EMAIL ?? "admin@example.com"} — password in .env (IDENTITY_ADMIN_PASSWORD)
  Mailpit :8025   Jaeger :16686
`);

  if (!published) {
    console.log(`  ACTION REQUIRED — port ${IDENTITY_PORT} could not be published automatically.
  Sign-in will fail until it is public: open the PORTS panel, right-click
  port ${IDENTITY_PORT} → Port Visibility → Public. (The token in a codespace
  often lacks the scope \`gh codespace ports visibility\` needs.)
`);
  }
}

main().catch((err) => {
  console.error(`\nProvisioning failed: ${err.message}`);
  process.exit(1);
});
