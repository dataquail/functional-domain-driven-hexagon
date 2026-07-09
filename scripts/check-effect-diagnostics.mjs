#!/usr/bin/env node
// CI gate for effect-language-service diagnostics. Runs the LS diagnostics
// over every project that contains Effect code and fails if any are reported.
// Per-rule severities (e.g. `preferSchemaOverJson: off`) live in the shared
// tsconfig plugin config (tsconfig.base.json), so what's reported here is
// exactly what the editor shows. Keeping this green means the v4 idioms the
// migration adopted (yieldable errors, Effect.fn handlers/endpoints, merged
// provides) don't regress.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Leaf tsconfigs with a non-empty `include` (the aggregator tsconfig.json in
// referenced packages has an empty include and would check nothing).
const PROJECTS = [
  "packages/contracts/tsconfig.src.json",
  "packages/contracts/tsconfig.test.json",
  "packages/database/tsconfig.src.json",
  "packages/database/tsconfig.test.json",
  "packages/api-client/tsconfig.src.json",
  "packages/server/tsconfig.src.json",
  "packages/server/tsconfig.test.json",
  "packages/jobs/tsconfig.src.json",
  // packages/jobs/tsconfig.test.json is omitted: loading it standalone trips a
  // TypeScript-internal "Debug Failure" in the LS graph worker (a tooling flake,
  // not an effect finding). The jobs source is gated above; its test surface is
  // one trivial integration file. Re-add if a TS/LS bump resolves the crash.
  "packages/cli/tsconfig.src.json",
  "packages/mcp/tsconfig.src.json",
  "packages/web/tsconfig.json",
  "packages/components/tsconfig.json",
].filter((p) => existsSync(join(ROOT, p)));

let totalFindings = 0;

for (const project of PROJECTS) {
  const res = spawnSync(
    "pnpm",
    ["exec", "effect-language-service", "diagnostics", "--project", project, "--format", "json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  let diagnostics = [];
  try {
    const parsed = JSON.parse(res.stdout || "[]");
    diagnostics = Array.isArray(parsed) ? parsed : (parsed.diagnostics ?? []);
  } catch {
    console.error(`✗ ${project}: could not parse diagnostics output`);
    if (res.stderr) console.error(res.stderr.slice(0, 2000));
    process.exit(2);
  }
  if (diagnostics.length > 0) {
    totalFindings += diagnostics.length;
    console.error(`✗ ${project}: ${diagnostics.length} effect diagnostic(s)`);
    for (const d of diagnostics) {
      const rel = (d.file ?? "").replace(`${ROOT}/`, "");
      console.error(`    ${rel}:${d.line}:${d.column}  ${d.name}`);
    }
  } else {
    console.log(`✓ ${project}`);
  }
}

if (totalFindings > 0) {
  console.error(
    `\n${totalFindings} effect diagnostic(s) found. Fix them, or adjust the rule severity in ` +
      `tsconfig.base.json's @effect/language-service plugin config if the rule doesn't apply.`,
  );
  process.exit(1);
}
console.log("\nNo effect-language-service diagnostics.");
