#!/usr/bin/env node
// CI gate for the Effect language-service diagnostics, run through
// `effect-tsgo diagnostics` (the LSP-based linter) rather than the standalone
// language-service binary.
//
// Errors and warnings fail the build. `message`-severity diagnostics are
// reported but do not gate: tsgo surfaces a class of advisory suggestions the
// previous backend did not, and adopting them is separate work from changing
// which tool reports them.
//
// Per-rule severities live in the shared tsconfig plugin config
// (tsconfig.base.json), so what's reported here is what the editor shows.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Leaf tsconfigs with a non-empty `include` (the aggregator tsconfig.json in
// referenced packages has an empty include and would check nothing).
const PROJECTS = [
  "packages/authz/tsconfig.src.json",
  "packages/authz/tsconfig.test.json",
  "packages/cqrs/tsconfig.src.json",
  "packages/cqrs/tsconfig.test.json",
  "packages/contracts/tsconfig.src.json",
  "packages/contracts/tsconfig.test.json",
  "packages/database/tsconfig.src.json",
  "packages/database/tsconfig.test.json",
  "packages/api-client/tsconfig.src.json",
  "packages/server/tsconfig.src.json",
  "packages/server/tsconfig.test.json",
  "packages/jobs/tsconfig.src.json",
  "packages/jobs/tsconfig.test.json",
  "packages/cli/tsconfig.src.json",
  "packages/mcp/tsconfig.src.json",
  "packages/web/tsconfig.json",
  "packages/components/tsconfig.json",
].filter((p) => existsSync(join(ROOT, p)));

const GATING = new Set(["error", "warning"]);

let gatingTotal = 0;
let messageTotal = 0;

for (const project of PROJECTS) {
  const res = spawnSync(
    "pnpm",
    ["exec", "effect-tsgo", "diagnostics", "--project", project, "--format", "json"],
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

  const gating = diagnostics.filter((d) => GATING.has(d.severity));
  const messages = diagnostics.length - gating.length;
  messageTotal += messages;

  if (gating.length > 0) {
    gatingTotal += gating.length;
    console.error(`✗ ${project}: ${gating.length} effect diagnostic(s)`);
    for (const d of gating) {
      const rel = (d.file ?? "").replace(`${ROOT}/`, "");
      console.error(`    ${rel}:${d.line}:${d.column}  ${d.severity} ${d.name}`);
    }
  } else {
    console.log(`✓ ${project}${messages > 0 ? `  (${messages} message-level)` : ""}`);
  }
}

if (gatingTotal > 0) {
  console.error(
    `\n${gatingTotal} effect diagnostic(s) found. Fix them, disable the rule for a line with ` +
      `\`// @effect-diagnostics-next-line <rule>:off\`, or adjust the severity in ` +
      `tsconfig.base.json's plugin config if the rule doesn't apply.`,
  );
  process.exit(1);
}
console.log(
  `\nNo gating effect diagnostics.${messageTotal > 0 ? ` ${messageTotal} message-level suggestion(s) not gated.` : ""}`,
);
