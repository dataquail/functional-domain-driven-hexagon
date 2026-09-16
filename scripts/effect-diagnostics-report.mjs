#!/usr/bin/env node
// Every Effect diagnostic as one line, `<file>(<line>,<column>): <severity>
// <name>: <message>`, positions one-based. The `effect-diagnostics` campaign
// in architecture.yaml reads this as its `report` and ledgers the
// message-level lines; the error and warning lines are what
// `pnpm check:effect` fails on.
import { readEffectDiagnostics, uniqueDiagnostics } from "./effect-diagnostics.mjs";

const firstLine = (message) => (message ?? "").split(/\r?\n/, 1)[0].trim();

for (const diagnostic of uniqueDiagnostics(await readEffectDiagnostics())) {
  process.stdout.write(
    `${diagnostic.file}(${diagnostic.line},${diagnostic.column}): ${diagnostic.severity} ` +
      `${diagnostic.name}: ${firstLine(diagnostic.message)}\n`,
  );
}
