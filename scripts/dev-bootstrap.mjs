#!/usr/bin/env node
// One-shot dev bootstrap. Idempotent — safe to re-run after partial failures.
// See docs/dev-setup.md for the stepwise breakdown of what this orchestrates.
//
// Phases:
//   1. ensure .env exists (copy from .env.example)
//   2. ensure SESSION_COOKIE_SECRET and BETTER_AUTH_SECRET are generated
//   3. bring up Postgres, Mailpit and Jaeger
//   4. ensure the identity database exists and IDENTITY_DATABASE_URL names it
//   5. migrate the dev and test databases, and the identity database
//   6. boot the identity Worker (`pnpm dev:cf`) and seed it: the app's OIDC
//      client and the admin, recorded in the app database as a super-admin

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { startCfDev } from "./lib/cf-dev.mjs";
import { readEnv, updateEnv } from "./lib/env-file.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const IDENTITY_DATABASE = "effect-monorepo-identity";
const IDENTITY_DATABASE_URL = `postgresql://postgres:postgres@localhost:5432/${IDENTITY_DATABASE}`;

const TOTAL_STEPS = 6;
const CF_DEV_BOOT_TIMEOUT_MS = 180_000;

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
  step(3, "bring up Postgres, Mailpit and Jaeger", servicesUp);
  step(4, "ensure the identity database exists", ensureIdentityDatabase);
  step(5, "migrate the dev, test and identity databases", migrate);
  await stepAsync(6, "seed the identity Worker (boots pnpm dev:cf for the duration)", seedIdentity);

  console.log("\nBootstrap complete. Next: `pnpm dev` (server, web and the identity Worker).");
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
  const result = spawnSync(
    "docker",
    ["compose", "up", "-d", "--wait", "postgres", "mailpit", "jaeger"],
    {
      cwd: ROOT,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) throw new Error("docker compose up failed");
  return "postgres + mailpit + jaeger up";
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

// Ahead of the seed, which writes the admin row into "user".users and needs both
// schemas to exist.
function migrate() {
  for (const args of [["db:migrate"], ["--filter", "@org/database", "db:migrate:test"]]) {
    const result = spawnSync("pnpm", args, { cwd: ROOT, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`pnpm ${args.join(" ")} failed`);
  }
  return "dev, test and identity databases migrated";
}

// The identity Worker only runs under `alchemy dev`, so it is up just long
// enough for the seed.
async function seedIdentity() {
  const dev = startCfDev(ROOT);
  try {
    const identityUrl = await dev.waitForOutput("identityUrl", CF_DEV_BOOT_TIMEOUT_MS);
    if (identityUrl === undefined) {
      throw new Error(`pnpm dev:cf never reported the identity Worker.\n${dev.output()}`);
    }
    const result = spawnSync("pnpm", ["seed:identity"], { cwd: ROOT, stdio: "inherit" });
    if (result.status !== 0) throw new Error("pnpm seed:identity failed");
    return `seeded through ${identityUrl}`;
  } finally {
    dev.stop();
  }
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
