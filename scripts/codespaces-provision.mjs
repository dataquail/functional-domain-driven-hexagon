#!/usr/bin/env node
// Zitadel bootstrap for the dev container, run from postStartCommand.
//
// The equivalent for a laptop is `pnpm bootstrap`, which drives the same
// sequence through `docker compose`. Here the stack is already running (the
// dev container is one of its services), so this talks to it directly:
//   1. wait for Zitadel to answer
//   2. read the bootstrap PAT FirstInstance wrote to the bind mount
//   3. wait for the gRPC management backend behind it
//   4. run the seed (OIDC app + admin row), capture client id/secret
//   5. publish port 8080, without which the OIDC back channel can't resolve
//
// Idempotent, and cheap once provisioned — a populated ZITADEL_CLIENT_ID
// short-circuits the whole thing.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { readEnv, updateEnv } from "./lib/env-file.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const PAT_FILE = join(ROOT, "infra/zitadel/.machinekey/zitadel-bootstrap.pat");

// Dialled over the Compose network; the instance is resolved from the Host
// header instead, which is the external domain whenever one is configured.
const ZITADEL_ADDRESS = process.env.ZITADEL_INTERNAL_URL ?? "http://zitadel:8080";

const READY_TIMEOUT_MS = 180_000;
const PAT_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

if (!existsSync(ENV_PATH)) {
  console.error("No .env — expected .devcontainer/initialize.sh to have created one.");
  process.exit(1);
}

const env = readEnv(ENV_PATH);
const instanceHost = env.ZITADEL_INSTANCE_HOST ?? "localhost:8080";

// `fetch` drops a `host` header (the Fetch spec forbids it), and Zitadel
// resolves the instance from exactly that header.
function zitadelRequest(path, { method = "GET", headers = {}, body } = {}) {
  const url = new URL(`${ZITADEL_ADDRESS}${path}`);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port !== "" ? url.port : 80,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...headers,
          host: instanceHost,
          ...(body === undefined ? {} : { "content-length": Buffer.byteLength(body) }),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode }),
        );
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function pollUntilOk(label, path, init, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await zitadelRequest(path, init);
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err?.code ?? err?.message ?? String(err);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `${label} did not come up at ${ZITADEL_ADDRESS}${path} (Host: ${instanceHost}) ` +
      `within ${Math.round(timeoutMs / 1000)}s — last: ${lastError}. ` +
      `Try \`docker logs effect-monorepo-zitadel\`.`,
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
    `Bootstrap PAT never appeared at ${PAT_FILE}. FirstInstance only fires against a ` +
      `brand-new Zitadel database, so a half-initialized volume never produces one — ` +
      `rebuilding the codespace is the quickest way back.`,
  );
}

function runSeed(pat) {
  if (!existsSync(join(ROOT, "infra/zitadel/node_modules"))) {
    const install = spawnSync("npm", ["install", "--silent", "--no-audit", "--no-fund"], {
      cwd: join(ROOT, "infra/zitadel"),
      stdio: "inherit",
    });
    if (install.status !== 0) throw new Error("installing the seed's dependencies failed");
  }

  const result = spawnSync("node", ["infra/zitadel/seed.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      ZITADEL_ISSUER: ZITADEL_ADDRESS,
      ZITADEL_INSTANCE_HOST: instanceHost,
      ZITADEL_BOOTSTRAP_PAT: pat,
      ZITADEL_ADMIN_EMAIL: env.ZITADEL_ADMIN_EMAIL ?? "admin@example.com",
      APP_DATABASE_URL:
        env.SEED_APP_DATABASE_URL ?? "postgresql://postgres:postgres@postgres:5432/effect-monorepo",
      APP_REDIRECT_URI: env.APP_REDIRECT_URI ?? "",
      APP_POST_LOGOUT_REDIRECT_URI: env.APP_POST_LOGOUT_REDIRECT_URI ?? "",
      SMTP_HOST: env.SMTP_HOST ?? "mailpit",
      SMTP_PORT: env.SMTP_PORT ?? "1025",
      SMTP_USER: env.SMTP_USER ?? "dev",
      SMTP_PASSWORD: env.SMTP_PASSWORD ?? "dev",
      SMTP_TLS: env.SMTP_TLS ?? "false",
      SMTP_FROM_ADDRESS: env.SMTP_FROM_ADDRESS ?? "noreply@localhost",
      SMTP_FROM_NAME: env.SMTP_FROM_NAME ?? "Effect Monorepo",
      SMTP_REPLY_TO: env.SMTP_REPLY_TO ?? "",
      SMTP_DESCRIPTION: env.SMTP_DESCRIPTION ?? "default",
    },
  });

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = /^.*__seed__\s+(.+)$/m.exec(combined);

  // Mirrored so a failing seed is debuggable, minus the credentials line —
  // lifecycle output lands in the codespace creation log.
  const redact = (text) => text.replace(/^.*__seed__\s+.+$/gm, "__seed__ <redacted>");
  if (result.stdout !== "") process.stdout.write(redact(result.stdout));
  if (result.stderr !== "") process.stderr.write(redact(result.stderr));
  if (result.status !== 0) throw new Error("the Zitadel seed exited non-zero");

  if (match === null) return null;

  const out = {};
  for (const pair of match[1].trim().split(/\s+/)) {
    const eq = pair.indexOf("=");
    if (eq !== -1) out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

// The server validates that the issuer it discovers equals ZITADEL_ISSUER, so
// browser and back channel have to reach Zitadel at the same URL. A private
// forwarded port answers a server-to-server call with GitHub's auth wall.
function publishZitadelPort() {
  if (process.env.CODESPACE_NAME === undefined) return "not a codespace — nothing to publish";
  const result = spawnSync(
    "gh",
    ["codespace", "ports", "visibility", "8080:public", "-c", process.env.CODESPACE_NAME],
    { encoding: "utf8" },
  );
  if (result.status === 0) return "port 8080 is public";
  return null;
}

async function main() {
  const alreadyProvisioned =
    env.ZITADEL_CLIENT_ID !== undefined && env.ZITADEL_CLIENT_ID.length > 0;

  if (!alreadyProvisioned) {
    console.log("Provisioning Zitadel…");
    await pollUntilOk("Zitadel", "/debug/ready", {}, READY_TIMEOUT_MS);
    const pat = await waitForPat();
    updateEnv(ENV_PATH, { ZITADEL_BOOTSTRAP_PAT: pat });

    // /debug/ready only reflects the HTTP front end; the gRPC backend behind
    // /management/* can lag it by seconds on a cold boot and 503 the seed.
    await pollUntilOk(
      "Zitadel management API",
      "/management/v1/projects/_search",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${pat}` },
        body: "{}",
      },
      READY_TIMEOUT_MS,
    );

    const seeded = runSeed(pat);
    if (seeded !== null) {
      updateEnv(ENV_PATH, {
        ZITADEL_CLIENT_ID: seeded.ZITADEL_CLIENT_ID,
        ZITADEL_CLIENT_SECRET: seeded.ZITADEL_CLIENT_SECRET,
      });
    }
  }

  const published = publishZitadelPort();

  console.log(`
Dev environment ready.

  pnpm dev        web on :3000, BFF on :3001
  Sign in         ${env.APP_URL ?? "http://localhost:3000"}/api/auth/login
  Credentials     ${env.ZITADEL_ADMIN_EMAIL ?? "admin@example.com"} — password in .env (ZITADEL_ADMIN_PASSWORD)
  Mailpit :8025   Jaeger :16686   Zitadel console :8080/ui/console
`);

  if (published === null) {
    console.log(`  ACTION REQUIRED — port 8080 could not be published automatically.
  Sign-in will fail until it is public: open the PORTS panel, right-click
  port 8080 → Port Visibility → Public. (The token in a codespace often
  lacks the scope \`gh codespace ports visibility\` needs.)
`);
  }
}

main().catch((err) => {
  console.error(`\nProvisioning failed: ${err.message}`);
  process.exit(1);
});
