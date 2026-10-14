#!/usr/bin/env node
// Turns a deployed stage's outputs into the environment the pipeline's next
// steps read. Every output named like an environment variable is exported;
// a redacted one is masked in the job log first.
//
//   pnpm -F @org/infra exec alchemy state read hexagon/<stage>/output --backend cloudflare \
//     | node scripts/stage-env.mjs
//
// Under Actions the variables are appended to $GITHUB_ENV and the masks go to
// stdout, where the runner reads workflow commands; elsewhere both print.

import { appendFileSync, readFileSync } from "node:fs";

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

const input = readFileSync(0, "utf8");
const start = input.indexOf("{");
if (start < 0) {
  console.error("stage-env: no JSON object in the stage outputs");
  process.exit(1);
}
const outputs = JSON.parse(input.slice(start));

const lines = [];
for (const [name, value] of Object.entries(outputs)) {
  if (!ENV_NAME.test(name)) continue;
  const redacted = typeof value === "object" && value !== null && "__redacted__" in value;
  const plain = redacted ? value.__redacted__ : value;
  if (typeof plain !== "string") continue;
  if (plain.includes("\n")) {
    console.error(`stage-env: ${name} spans several lines, which GITHUB_ENV cannot take`);
    process.exit(1);
  }
  if (redacted) process.stdout.write(`::add-mask::${plain}\n`);
  lines.push(`${name}=${plain}`);
}

if (lines.length === 0) {
  console.error("stage-env: the stage has no environment outputs");
  process.exit(1);
}
const environment = `${lines.join("\n")}\n`;
if (process.env.GITHUB_ENV === undefined) process.stdout.write(environment);
else appendFileSync(process.env.GITHUB_ENV, environment);
