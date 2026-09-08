#!/usr/bin/env node
// `architecture check` gates violations, coverage floors, the baseline and the
// adoption ceilings. `architecture conformance` measures what it does not:
// residue (files no family reaches), vacancy (allowlisted nodes no file
// reaches), slack (allowances nothing imports through), concentration (a
// fragment entry used at few of the nodes granted it) and cycles anywhere in
// the graph. None of them fails a build on its own, so this script holds them
// to ceilings that only ever go down — the same ratchet the coverage floors
// follow, in the other direction.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ROOTS = ["packages"];

// Set each to what `pnpm architecture:conformance` reports. Lower a ceiling
// when the number falls; never raise one to make a red run green — the fix is
// deleting the allowance, reaching the file, or breaking the cycle.
const CEILINGS = {
  residue: 0,
  vacant: 13,
  slack: 63,
  concentration: 11,
  cycles: 0,
};

const snapshot = JSON.parse(
  execFileSync(
    path.join(repoRoot, "node_modules", ".bin", "architecture"),
    ["conformance", "--json", ...ROOTS],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ),
);

if (snapshot.version !== 1) {
  console.error(
    `conformance snapshot version ${String(snapshot.version)} is not the 1 this script reads`,
  );
  process.exit(1);
}

const measured = {
  residue: snapshot.residue.files.length,
  vacant: snapshot.vacant.length,
  slack: snapshot.slack.length,
  // The report's own threshold: an entry used at fewer than half its nodes.
  concentration: snapshot.concentration.filter((one) => one.usedAt * 2 < one.of).length,
  cycles: snapshot.cycles,
};

const rows = Object.entries(CEILINGS).map(([measure, ceiling]) => {
  const actual = measured[measure];
  const verdict = actual > ceiling ? "✗ over" : actual < ceiling ? "↓ lower the ceiling" : "✓";
  return { measure, actual, ceiling, verdict };
});

console.log(
  `${String(snapshot.files)} files under ${ROOTS.join(", ")}, against ${snapshot.manifest.path}`,
);
console.log("");
for (const { measure, actual, ceiling, verdict } of rows) {
  console.log(
    `  ${measure.padEnd(14)} ${String(actual).padStart(5)}  ≤ ${String(ceiling).padEnd(5)} ${verdict}`,
  );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "## Architecture conformance",
      "",
      "| Measure | Actual | Ceiling | |",
      "| --- | ---: | ---: | --- |",
      ...rows.map(
        (r) => `| ${r.measure} | ${String(r.actual)} | ${String(r.ceiling)} | ${r.verdict} |`,
      ),
      "",
    ].join("\n"),
  );
}

const over = rows.filter((r) => r.actual > r.ceiling);
if (over.length > 0) {
  console.error("");
  console.error(
    `conformance fell: ${over.map((r) => `${r.measure} ${String(r.actual)} > ${String(r.ceiling)}`).join(", ")}.`,
  );
  console.error(
    "Run `pnpm architecture:conformance` to see which files, nodes, allowances or cycles.",
  );
  process.exit(1);
}
