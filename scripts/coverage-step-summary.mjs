#!/usr/bin/env node
// Renders the merged coverage report as a GitHub job summary, so a failed
// threshold is legible from the checks tab without downloading the HTML
// artifact. Reads `coverage/coverage-summary.json` (the `json-summary`
// reporter, enabled only for the merging run) and never fails the build —
// `pnpm coverage:merge` is what gates.
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUMMARY_FILE = join(ROOT, "coverage", "coverage-summary.json");

// Same buckets as the per-package thresholds in vitest.config.ts, so the table
// rows line up with what the gate actually checks.
const BUCKETS = [
  ["@org/server", "packages/server/"],
  ["@org/web", "packages/web/"],
  ["@org/database", "packages/database/"],
  ["@org/contracts", "packages/contracts/"],
  ["@org/jobs", "packages/jobs/"],
];
const METRICS = ["statements", "branches", "functions", "lines"];

if (!existsSync(SUMMARY_FILE)) {
  console.log(`no coverage summary at ${relative(ROOT, SUMMARY_FILE)} — nothing to report`);
  process.exit(0);
}

const summary = JSON.parse(readFileSync(SUMMARY_FILE, "utf8"));

const emptyTotals = () => Object.fromEntries(METRICS.map((m) => [m, { covered: 0, total: 0 }]));

const add = (totals, entry) => {
  for (const metric of METRICS) {
    totals[metric].covered += entry[metric].covered;
    totals[metric].total += entry[metric].total;
  }
};

const buckets = new Map(BUCKETS.map(([label]) => [label, emptyTotals()]));

for (const [file, entry] of Object.entries(summary)) {
  if (file === "total") continue;
  const rel = relative(ROOT, file);
  const bucket = BUCKETS.find(([, prefix]) => rel.startsWith(prefix));
  if (bucket !== undefined) add(buckets.get(bucket[0]), entry);
}

// A metric with nothing to measure (a package with no branches at all) is
// vacuously complete — istanbul reports it as 100%, and so do we.
const pct = ({ covered, total }) =>
  total === 0 ? "—" : `${((covered / total) * 100).toFixed(2)}%`;

const rows = [...buckets].filter(([, totals]) => totals.lines.total > 0);

const lines = [
  "## Test coverage (unit + integration, merged)",
  "",
  `| Package | ${METRICS.map((m) => m[0].toUpperCase() + m.slice(1)).join(" | ")} |`,
  `| --- | ${METRICS.map(() => "---:").join(" | ")} |`,
  ...rows.map(([label, t]) => `| ${label} | ${METRICS.map((m) => pct(t[m])).join(" | ")} |`),
  `| **Total** | ${METRICS.map((m) => `**${pct(summary.total[m])}**`).join(" | ")} |`,
  "",
  "Thresholds live in `vitest.config.ts` and are checked only against this merged number.",
];

const output = lines.join("\n") + "\n";
console.log(output);

if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);
}
