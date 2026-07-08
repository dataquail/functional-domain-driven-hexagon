#!/usr/bin/env node
// Phase 1: flip effect deps to v4 beta across the workspace.
// - BUMP (stay separate packages): effect, @effect/platform-node, @effect/opentelemetry, @effect/vitest
// - REMOVE (absorbed into effect core / effect/unstable/*): @effect/platform, @effect/sql,
//   @effect/cluster, @effect/experimental, @effect/rpc, @effect/workflow, @effect/cli,
//   @effect/printer, @effect/printer-ansi, @effect/platform-browser
// Idempotent; rewrites package.json files in place.
import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";

const PIN = "4.0.0-beta.94";
const BUMP = new Set([
  "effect",
  "@effect/platform-node",
  "@effect/opentelemetry",
  "@effect/vitest",
]);
const REMOVE = new Set([
  "@effect/platform",
  "@effect/sql",
  "@effect/cluster",
  "@effect/experimental",
  "@effect/rpc",
  "@effect/workflow",
  "@effect/cli",
  "@effect/printer",
  "@effect/printer-ansi",
  "@effect/platform-browser",
]);

const files = globSync("packages/*/package.json").concat(["package.json"]);
const report = [];

for (const file of files) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  let changed = false;
  for (const sec of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = json[sec];
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (REMOVE.has(name)) {
        delete deps[name];
        report.push(`${file}: - ${name}`);
        changed = true;
      } else if (
        BUMP.has(name) &&
        deps[name] !== PIN &&
        !String(deps[name]).startsWith("workspace:")
      ) {
        report.push(`${file}: ${name} ${deps[name]} -> ${PIN}`);
        deps[name] = PIN;
        changed = true;
      }
    }
  }
  // root pnpm.overrides
  if (json.pnpm?.overrides) {
    const o = json.pnpm.overrides;
    for (const name of Object.keys(o)) {
      if (REMOVE.has(name)) {
        delete o[name];
        report.push(`${file}[override]: - ${name}`);
        changed = true;
      } else if (BUMP.has(name) && o[name] !== PIN) {
        report.push(`${file}[override]: ${name} ${o[name]} -> ${PIN}`);
        o[name] = PIN;
        changed = true;
      }
    }
  }
  if (changed) writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}
console.log(report.join("\n"));
console.log(`\n${report.length} changes across ${files.length} files.`);
