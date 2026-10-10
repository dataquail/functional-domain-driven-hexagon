#!/usr/bin/env node
// Boots the Workers stack under `alchemy dev`, asks the placeholder Worker for
// `SELECT 1` through the app Hyperdrive, and tears the stack down again. Exits
// non-zero unless the docker Postgres in DATABASE_URL answered.
//
// Everything runs locally: under `alchemy dev` the stack touches neither
// Cloudflare nor Neon, so this needs no credentials.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BOOT_TIMEOUT_MS = 120_000;
const QUERY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;

const PLACEHOLDER_URL = /placeholderUrl: '([^']+)'/;

const dev = spawn("pnpm", ["dev:cf"], {
  cwd: ROOT,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
dev.stdout.on("data", (chunk) => (output += chunk));
dev.stderr.on("data", (chunk) => (output += chunk));

// `alchemy dev` runs a supervisor, a child and workerd; signalling the process
// group is what stops all three.
const stop = () => {
  try {
    process.kill(-dev.pid, "SIGINT");
  } catch {
    /* already gone */
  }
};
process.on("exit", stop);
process.on("SIGINT", () => process.exit(130));

const waitFor = async (timeoutMs, probe) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) return value;
    if (dev.exitCode !== null) return undefined;
    await sleep(POLL_INTERVAL_MS);
  }
  return undefined;
};

const fail = (message) => {
  process.stderr.write(`${message}\n\n--- alchemy dev output ---\n${output}\n`);
  process.exit(1);
};

const url = await waitFor(BOOT_TIMEOUT_MS, () => PLACEHOLDER_URL.exec(output)?.[1]);
if (url === undefined) fail("alchemy dev never reported the placeholder Worker's URL.");

const answer = await waitFor(QUERY_TIMEOUT_MS, async () => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
});
if (answer === undefined) fail(`The placeholder Worker at ${url} never answered.`);

const [row] = answer;
if (row?.one !== 1) fail(`Expected SELECT 1 to return one = 1, got ${JSON.stringify(answer)}.`);

process.stdout.write(
  `✓ ${url} answered SELECT 1 through Hyperdrive from database "${row.database}".\n`,
);
process.exit(0);
