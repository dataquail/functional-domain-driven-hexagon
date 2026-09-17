#!/usr/bin/env node
// CI gate for the Effect language-service diagnostics: any finding at any
// severity fails the build. Per-rule severities live in tsconfig.base.json's
// plugin config, so a rule the repository decides against is turned off there
// rather than tolerated here.
import { readEffectDiagnostics } from "./effect-diagnostics.mjs";

const perProject = await readEffectDiagnostics().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(2);
});

let total = 0;
for (const { diagnostics, project } of perProject) {
  if (diagnostics.length > 0) {
    total += diagnostics.length;
    console.error(`✗ ${project}: ${diagnostics.length} effect diagnostic(s)`);
    for (const d of diagnostics) {
      console.error(`    ${d.file}:${d.line}:${d.column}  ${d.severity} ${d.name}`);
    }
  } else {
    console.log(`✓ ${project}`);
  }
}

if (total > 0) {
  console.error(
    `\n${total} effect diagnostic(s) found. Fix them, disable the rule for a line with ` +
      `\`// @effect-diagnostics-next-line <rule>:off\`, or adjust the severity in ` +
      `tsconfig.base.json's plugin config if the rule doesn't apply.`,
  );
  process.exit(1);
}
console.log("\nNo effect diagnostics.");
