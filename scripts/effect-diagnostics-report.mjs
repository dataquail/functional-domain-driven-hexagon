#!/usr/bin/env node
// Writes every Effect diagnostic as one line, `<file>(<line>,<column>):
// <severity> <name>: <message>`, positions one-based, to the report file the
// `effect-diagnostics` campaign in architecture.yaml reads. The campaign
// ledgers the message-level lines; the error and warning lines are what
// `pnpm check:effect` fails on. The campaign reads a file rather than running
// this itself because oxlint hosts its plugins in the linter's own process,
// and forking a shell from that process fails with ENOMEM on a CI runner.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readEffectDiagnostics, ROOT, uniqueDiagnostics } from "./effect-diagnostics.mjs";

export const REPORT_FILE = ".effect-diagnostics-report.txt";

const firstLine = (message) => (message ?? "").split(/\r?\n/, 1)[0].trim();

const diagnostics = uniqueDiagnostics(await readEffectDiagnostics());
const lines = diagnostics.map(
  (d) => `${d.file}(${d.line},${d.column}): ${d.severity} ${d.name}: ${firstLine(d.message)}`,
);
writeFileSync(join(ROOT, REPORT_FILE), lines.map((line) => `${line}\n`).join(""));
console.log(`${REPORT_FILE}: ${diagnostics.length} effect diagnostic(s)`);
