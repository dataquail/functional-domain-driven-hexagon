#!/usr/bin/env node
// CI gate for the Effect language-service diagnostics. Errors and warnings
// fail the build. `message`-severity diagnostics are reported but do not
// gate: they are ledgered by the `effect-diagnostics` campaign in
// architecture.yaml, which is what ratchets them down.
import { readEffectDiagnostics, uniqueDiagnostics } from "./effect-diagnostics.mjs";

const GATING = new Set(["error", "warning"]);

const perProject = await readEffectDiagnostics().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(2);
});

let gatingTotal = 0;
for (const { diagnostics, project } of perProject) {
  const gating = diagnostics.filter((d) => GATING.has(d.severity));
  const messages = diagnostics.length - gating.length;
  if (gating.length > 0) {
    gatingTotal += gating.length;
    console.error(`✗ ${project}: ${gating.length} effect diagnostic(s)`);
    for (const d of gating) {
      console.error(`    ${d.file}:${d.line}:${d.column}  ${d.severity} ${d.name}`);
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
const messageTotal = uniqueDiagnostics(perProject).filter((d) => !GATING.has(d.severity)).length;
console.log(
  `\nNo gating effect diagnostics.${messageTotal > 0 ? ` ${messageTotal} message-level suggestion(s) not gated; the effect-diagnostics campaign ledgers them.` : ""}`,
);
