// Enforces that every file matching a "subject" pattern has a sibling test file.
// Today this covers HTTP handlers (one test per endpoint). Extend `rules` when
// the same parity is wanted for commands/queries/event-handlers.

import * as Glob from "glob";
import * as Fs from "node:fs";
import * as Path from "node:path";

const rules = [
  {
    label: "HTTP endpoint",
    subject: "packages/server/src/modules/*/interface/*.endpoint.ts",
    // First match wins: a unit test or an integration test both satisfy the rule.
    candidates: [
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.integration.test.ts"),
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.test.ts"),
    ],
  },
];

let missing = 0;
for (const rule of rules) {
  const subjects = Glob.globSync(rule.subject, { ignore: "**/*.test.ts" });
  for (const subject of subjects) {
    const tried = rule.candidates.map((fn) => fn(subject));
    if (!tried.some((p) => Fs.existsSync(p))) {
      missing++;
      const rel = Path.relative(process.cwd(), subject);
      console.error(`✖ ${rule.label} missing a sibling test: ${rel}`);
      for (const t of tried) {
        console.error(`    expected one of: ${Path.relative(process.cwd(), t)}`);
      }
    }
  }
}

if (missing > 0) {
  console.error(`\n${missing} file(s) without a sibling test.`);
  process.exit(1);
}
console.log("✔ all subjects have sibling tests");
