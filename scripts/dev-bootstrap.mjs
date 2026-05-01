#!/usr/bin/env node
// One-shot dev bootstrap. Idempotent — safe to re-run after partial failures.
// See docs/dev-setup.md for the stepwise breakdown of what this orchestrates.
//
// Phases:
//   1. ensure .env exists (copy from .env.example)
//   2. ensure SESSION_COOKIE_SECRET is generated
//   3. bring up Zitadel (compose pulls postgres in via depends_on)
//   4. wait for Zitadel /debug/ready
//   5. wait for the FirstInstance bootstrap PAT to land on disk
//   6. write the PAT into .env as ZITADEL_BOOTSTRAP_PAT
//   7. wait for the gRPC management API to actually answer requests
//   8. run the seed (creates the OIDC app, seeds the admin user)
//   9. write ZITADEL_CLIENT_ID + ZITADEL_CLIENT_SECRET into .env

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

const READY_TIMEOUT_MS = 180_000;
const PAT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

async function main() {
  step(1, "ensure .env exists", ensureEnvFile);
  step(2, "ensure SESSION_COOKIE_SECRET is set", ensureSessionSecret);
  step(3, "bring up Zitadel containers", authUp);
  await stepAsync(4, "wait for Zitadel /debug/ready", waitForReady);
  const pat = await stepAsync(5, "wait for bootstrap PAT", waitForPat);
  step(6, "persist ZITADEL_BOOTSTRAP_PAT in .env", () =>
    updateEnv(ENV_PATH, { ZITADEL_BOOTSTRAP_PAT: pat }),
  );
  await stepAsync(7, "wait for Zitadel management API", () => waitForManagementApi(pat));
  const seedOutput = step(8, "run seed (idempotent)", runSeed);
  step(9, "persist ZITADEL_CLIENT_ID + ZITADEL_CLIENT_SECRET in .env", () => {
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

  console.log("\nBootstrap complete. Next: `pnpm dev`.");
}

// Phases ---------------------------------------------------------------

function ensureEnvFile() {
  if (existsSync(ENV_PATH)) return ".env already present";
  copyFileSync(ENV_EXAMPLE, ENV_PATH);
  return "copied .env.example → .env";
}

function ensureSessionSecret() {
  const env = readEnv(ENV_PATH);
  if (env.SESSION_COOKIE_SECRET !== undefined && env.SESSION_COOKIE_SECRET.length > 0) {
    return "already set";
  }
  const secret = randomBytes(32).toString("hex");
  updateEnv(ENV_PATH, { SESSION_COOKIE_SECRET: secret });
  return "generated 32-byte secret";
}

function authUp() {
  // zitadel's depends_on ensures postgres is healthy before zitadel starts.
  // Zitadel itself has no healthcheck (the image is distroless, so probing
  // it from inside is awkward) — phase 4 polls /debug/ready from the host.
  const result = spawnSync("docker", ["compose", "up", "-d", "zitadel"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("docker compose up failed");
  return "postgres + zitadel up";
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
  process.stdout.write(`[${n}/9] ${label}… `);
  const result = fn();
  console.log(typeof result === "string" ? `✓ ${result}` : "✓");
  return result;
}

async function stepAsync(n, label, fn) {
  process.stdout.write(`[${n}/9] ${label}… `);
  const result = await fn();
  console.log(typeof result === "string" ? `✓ ${result}` : "✓");
  return result;
}

main().catch((err) => {
  console.error(`\nBootstrap failed: ${err.message}`);
  process.exit(1);
});
