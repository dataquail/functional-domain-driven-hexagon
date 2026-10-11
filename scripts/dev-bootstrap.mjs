#!/usr/bin/env node
// One-shot dev bootstrap. Idempotent — safe to re-run after partial failures.
// See docs/dev-setup.md for the stepwise breakdown of what this orchestrates.
//
// Phases:
//   1. ensure .env exists (copy from .env.example)
//   2. ensure SESSION_COOKIE_SECRET and BETTER_AUTH_SECRET are generated
//   3. bring up Zitadel, Mailpit and Jaeger (compose pulls postgres in via depends_on)
//   4. ensure the identity database exists and IDENTITY_DATABASE_URL names it
//   5. migrate the dev and test databases
//   6. wait for Zitadel /debug/ready
//   7. wait for the FirstInstance bootstrap PAT to land on disk
//   8. write the PAT into .env as ZITADEL_BOOTSTRAP_PAT
//   9. wait for the gRPC management API to actually answer requests
//  10. run the seed (creates the OIDC app, seeds the admin user)
//  11. write ZITADEL_CLIENT_ID + ZITADEL_CLIENT_SECRET into .env

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { readEnv, updateEnv } from "./lib/env-file.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const PAT_FILE = join(ROOT, "infra/zitadel/.machinekey/zitadel-bootstrap.pat");
const ZITADEL_READY_URL =
  process.env.ZITADEL_ISSUER !== undefined && process.env.ZITADEL_ISSUER !== ""
    ? `${process.env.ZITADEL_ISSUER}/debug/ready`
    : "http://localhost:8080/debug/ready";

const IDENTITY_DATABASE = "effect-monorepo-identity";
const IDENTITY_DATABASE_URL = `postgresql://postgres:postgres@localhost:5432/${IDENTITY_DATABASE}`;

const TOTAL_STEPS = 11;
const READY_TIMEOUT_MS = 180_000;
const PAT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

// This drives `docker compose` from the workspace, which in a codespace is
// itself a container: Compose would resolve the relative bind paths to
// container-side paths the VM's daemon cannot see, and the fixed
// `container_name`s mean the resulting broken containers replace the working
// ones. Provisioning there goes through scripts/codespaces-provision.mjs.
if (process.env.CODESPACES !== undefined) {
  console.error(
    "This drives `docker compose` from the workspace and only works on a laptop.\n" +
      "In a codespace the stack is already running — use `node scripts/codespaces-provision.mjs`.\n" +
      "See docs/codespaces.md.",
  );
  process.exit(1);
}

async function main() {
  step(1, "ensure .env exists", ensureEnvFile);
  step(2, "ensure SESSION_COOKIE_SECRET and BETTER_AUTH_SECRET are set", ensureSecrets);
  step(3, "bring up Zitadel, Mailpit and Jaeger", servicesUp);
  step(4, "ensure the identity database exists", ensureIdentityDatabase);
  step(5, "migrate the dev + test databases", migrate);
  await stepAsync(6, "wait for Zitadel /debug/ready", waitForReady);
  const pat = await stepAsync(7, "wait for bootstrap PAT", waitForPat);
  step(8, "persist ZITADEL_BOOTSTRAP_PAT in .env", () =>
    updateEnv(ENV_PATH, { ZITADEL_BOOTSTRAP_PAT: pat }),
  );
  await stepAsync(9, "wait for Zitadel management API", () => waitForManagementApi(pat));
  const seedOutput = step(10, "run seed (idempotent)", runSeed);
  step(11, "persist ZITADEL_CLIENT_ID + ZITADEL_CLIENT_SECRET in .env", () => {
    if (seedOutput === null) {
      console.log(
        "    (seed didn't emit a __seed__ line — the OIDC app already existed; .env unchanged)",
      );
      return;
    }
    updateEnv(ENV_PATH, {
      ZITADEL_CLIENT_ID: seedOutput.ZITADEL_CLIENT_ID,
      ZITADEL_CLIENT_SECRET: seedOutput.ZITADEL_CLIENT_SECRET,
    });
  });

  console.log("\nBootstrap complete. Next: `pnpm dev` (or `pnpm dev:cf` for the Workers stack).");
}

// Phases ---------------------------------------------------------------

function ensureEnvFile() {
  if (existsSync(ENV_PATH)) return ".env already present";
  copyFileSync(ENV_EXAMPLE, ENV_PATH);
  return "copied .env.example → .env";
}

function ensureSecrets() {
  const env = readEnv(ENV_PATH);
  const missing = ["SESSION_COOKIE_SECRET", "BETTER_AUTH_SECRET"].filter(
    (name) => env[name] === undefined || env[name].length === 0,
  );
  if (missing.length === 0) return "already set";
  updateEnv(
    ENV_PATH,
    Object.fromEntries(missing.map((name) => [name, randomBytes(32).toString("hex")])),
  );
  return `generated ${missing.join(" and ")}`;
}

function servicesUp() {
  // zitadel's depends_on ensures postgres is healthy before zitadel starts.
  // Zitadel itself has no healthcheck (the image is distroless, so probing
  // it from inside is awkward) — a later step polls /debug/ready from the host.
  const result = spawnSync("docker", ["compose", "up", "-d", "zitadel", "mailpit", "jaeger"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("docker compose up failed");
  return "postgres + zitadel + mailpit + jaeger up";
}

// `pnpm dev:cf` points the identity Hyperdrive at this database. Created here
// rather than by a postgres init script, which only runs on a fresh volume.
function ensureIdentityDatabase() {
  const psql = (sql) =>
    spawnSync(
      "docker",
      ["compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-tAc", sql],
      { cwd: ROOT, encoding: "utf8" },
    );
  const existing = psql(`SELECT 1 FROM pg_database WHERE datname = '${IDENTITY_DATABASE}'`);
  if (existing.status !== 0) throw new Error(`psql failed: ${existing.stderr}`);
  if (existing.stdout.trim() !== "1") {
    const created = psql(`CREATE DATABASE "${IDENTITY_DATABASE}"`);
    if (created.status !== 0) throw new Error(`CREATE DATABASE failed: ${created.stderr}`);
  }
  const env = readEnv(ENV_PATH);
  if (env.IDENTITY_DATABASE_URL === undefined || env.IDENTITY_DATABASE_URL === "") {
    updateEnv(ENV_PATH, { IDENTITY_DATABASE_URL });
  }
  return IDENTITY_DATABASE;
}

// Ahead of the seed, which writes the admin row into "user".users and needs the
// schema to exist.
function migrate() {
  for (const args of [["db:migrate"], ["--filter", "@org/database", "db:migrate:test"]]) {
    const result = spawnSync("pnpm", args, { cwd: ROOT, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`pnpm ${args.join(" ")} failed`);
  }
  return "dev + test databases migrated";
}

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(ZITADEL_READY_URL);
      if (res.ok) return ZITADEL_READY_URL;
    } catch {
      /* not yet */
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Zitadel did not become ready at ${ZITADEL_READY_URL} within ${Math.round(READY_TIMEOUT_MS / 1000)}s. Check \`docker compose logs zitadel\`.`,
  );
}

async function waitForPat() {
  const deadline = Date.now() + PAT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (existsSync(PAT_FILE)) {
      const value = readFileSync(PAT_FILE, "utf8").trim();
      if (value.length > 0) return value;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Bootstrap PAT never appeared at ${PAT_FILE} within ${Math.round(PAT_TIMEOUT_MS / 1000)}s. ` +
      `If you initialized Zitadel before the FirstInstance.Org.Machine config was added, run \`pnpm auth:reset\` and retry.`,
  );
}

// /debug/ready reflects HTTP server health, but the gRPC management backend
// can lag behind by a few seconds on cold boots. Without this wait the seed
// can race in and hit a "transport: connection refused" 503. Smoke-tests
// /management/v1/projects/_search with the bootstrap PAT until it returns OK.
async function waitForManagementApi(pat) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const url = ZITADEL_READY_URL.replace(/\/debug\/ready$/, "/management/v1/projects/_search");
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${pat}`,
          host: "localhost:8080",
        },
        body: "{}",
      });
      if (res.ok) return "management API up";
    } catch {
      /* not yet */
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Zitadel management API never came up at ${url}.`);
}

function runSeed() {
  const result = spawnSync(
    "docker",
    ["compose", "--profile", "seed-zitadel", "up", "--abort-on-container-exit", "seed-zitadel"],
    { cwd: ROOT, encoding: "utf8" },
  );
  // Mirror seed output to the user so they can debug if anything went weird.
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error("seed-zitadel container exited non-zero");

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = /^.*__seed__\s+(.+)$/m.exec(combined);
  if (match === null) return null;

  const out = {};
  for (const pair of match[1].trim().split(/\s+/)) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

// Logging --------------------------------------------------------------

function step(n, label, fn) {
  process.stdout.write(`[${n}/${TOTAL_STEPS}] ${label}… `);
  const result = fn();
  console.log(typeof result === "string" ? `✓ ${result}` : "✓");
  return result;
}

async function stepAsync(n, label, fn) {
  process.stdout.write(`[${n}/${TOTAL_STEPS}] ${label}… `);
  const result = await fn();
  console.log(typeof result === "string" ? `✓ ${result}` : "✓");
  return result;
}

main().catch((err) => {
  console.error(`\nBootstrap failed: ${err.message}`);
  process.exit(1);
});
