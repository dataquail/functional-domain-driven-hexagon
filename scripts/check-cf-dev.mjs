#!/usr/bin/env node
// Boots the Workers stack under `alchemy dev`, asks the placeholder Worker for
// `SELECT 1` through the app Hyperdrive, and tears the stack down again. Exits
// non-zero unless the docker Postgres in DATABASE_URL answered.
//
// Everything runs locally: under `alchemy dev` the stack touches neither
// Cloudflare nor Neon, so this needs no credentials.

import { fileURLToPath } from "node:url";

import { startCfDev } from "./lib/cf-dev.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BOOT_TIMEOUT_MS = 120_000;
const QUERY_TIMEOUT_MS = 60_000;

const dev = startCfDev(ROOT);
process.on("exit", dev.stop);
process.on("SIGINT", () => process.exit(130));

const fail = (message) => {
  process.stderr.write(`${message}\n\n--- alchemy dev output ---\n${dev.output()}\n`);
  process.exit(1);
};

const url = await dev.waitForOutput("placeholderUrl", BOOT_TIMEOUT_MS);
if (url === undefined) fail("alchemy dev never reported the placeholder Worker's URL.");

const answer = await dev.waitFor(QUERY_TIMEOUT_MS, async () => {
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
