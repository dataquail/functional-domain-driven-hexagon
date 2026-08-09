#!/usr/bin/env node
// Captures a normalized lint-findings snapshot from either linter so the two can
// be diffed on an identical file set. Phase 0 records the ESLint oracle; Phase 5
// diffs oxlint against it.
//
//   node scripts/lint-parity.mjs eslint  > .lint-oracle.json
//   node scripts/lint-parity.mjs oxlint  > .lint-candidate.json
//   node scripts/lint-parity.mjs diff .lint-oracle.json .lint-candidate.json

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const LINT_GLOBS = [
  "**/{src,test,examples,dtslint}/**/*.{ts,mjs,tsx}",
  "packages/web/{app,features,lib,services}/**/*.{ts,tsx}",
  "packages/web/{instrumentation,next.config}.ts",
  "packages/components/{primitives,patterns,providers,lib}/**/*.{ts,tsx}",
  "packages/components/.storybook/**/*.{ts,tsx}",
  "packages/acceptance/{specs,drivers,test-utils,setup}/**/*.{ts,tsx}",
  "packages/acceptance/{playwright.config,global-setup}.ts",
];

const repoRoot = process.cwd();
const rel = (p) => path.relative(repoRoot, path.resolve(repoRoot, p)).replaceAll(path.sep, "/");

// oxlint reports `plugin(rule)`; eslint reports `plugin/rule`. Normalize to
// `plugin/rule` so the same finding compares equal across linters.
const normalizeRule = (ruleId) => {
  if (typeof ruleId !== "string" || ruleId.length === 0) return "(unknown)";
  const parenthesized = /^(.+?)\((.+)\)$/.exec(ruleId);
  const id = parenthesized ? `${parenthesized[1]}/${parenthesized[2]}` : ruleId;
  return id
    .replace(/^@typescript-eslint\//, "typescript/")
    .replace(/^eslint\//, "")
    .replace(/^oxc\//, "");
};

const runJson = (cmd, args) => {
  try {
    return execFileSync(cmd, args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    // Both linters exit non-zero when they report findings; stdout is still valid.
    if (typeof error.stdout === "string" && error.stdout.length > 0) return error.stdout;
    throw error;
  }
};

const collectEslint = () => {
  const raw = runJson("npx", ["eslint", ...LINT_GLOBS, "--format=json"]);
  return JSON.parse(raw).flatMap((file) =>
    file.messages.map((m) => ({
      file: rel(file.filePath),
      line: m.line ?? 0,
      rule: normalizeRule(m.ruleId),
      severity: m.severity === 2 ? "error" : "warning",
    })),
  );
};

// oxlint takes paths, not ESLint-style globs. `packages` reproduces the exact
// 844-file set the LINT_GLOBS above select, given the config's ignorePatterns.
const OXLINT_PATHS = ["packages"];

const collectOxlint = () => {
  const raw = runJson("npx", ["oxlint", "--type-aware", ...OXLINT_PATHS, "--format=json"]);
  const parsed = JSON.parse(raw);
  const diagnostics = Array.isArray(parsed) ? parsed : (parsed.diagnostics ?? []);
  return diagnostics.map((d) => ({
    file: rel(d.filename ?? d.labels?.[0]?.filename ?? ""),
    line: d.labels?.[0]?.line ?? d.line ?? 0,
    rule: normalizeRule(d.code),
    severity: d.severity === "warning" ? "warning" : "error",
  }));
};

const key = (f) => `${f.file}:${f.line}:${f.rule}`;

const summarize = (findings) => {
  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  return Object.fromEntries(Object.entries(byRule).sort((a, b) => b[1] - a[1]));
};

const [mode, ...rest] = process.argv.slice(2);

if (mode === "eslint" || mode === "oxlint") {
  const findings = mode === "eslint" ? collectEslint() : collectOxlint();
  findings.sort((a, b) => key(a).localeCompare(key(b)));
  process.stdout.write(
    `${JSON.stringify({ linter: mode, total: findings.length, byRule: summarize(findings), findings }, null, 2)}\n`,
  );
} else if (mode === "diff") {
  const [oraclePath, candidatePath] = rest;
  const oracle = JSON.parse(readFileSync(oraclePath, "utf8"));
  const candidate = JSON.parse(readFileSync(candidatePath, "utf8"));
  const oracleKeys = new Set(oracle.findings.map(key));
  const candidateKeys = new Set(candidate.findings.map(key));

  const missing = oracle.findings.filter((f) => !candidateKeys.has(key(f)));
  const extra = candidate.findings.filter((f) => !oracleKeys.has(key(f)));

  process.stdout.write(
    `${JSON.stringify(
      {
        oracleTotal: oracle.total,
        candidateTotal: candidate.total,
        missingCount: missing.length,
        extraCount: extra.length,
        missingByRule: summarize(missing),
        extraByRule: summarize(extra),
        missing,
        extra,
      },
      null,
      2,
    )}\n`,
  );
  // A finding the oracle has and the candidate lacks is the dangerous direction:
  // it means a rule went vacuous.
  process.exitCode = missing.length > 0 ? 1 : 0;
} else {
  process.stderr.write("usage: lint-parity.mjs <eslint|oxlint|diff <oracle> <candidate>>\n");
  process.exitCode = 2;
}
