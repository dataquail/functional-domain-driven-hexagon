import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import {
  type Baseline,
  baselineOf,
  decodeBaseline,
  EMPTY_BASELINE,
  serializeBaseline,
  staleEntriesOf,
  unbaselined,
} from "../../core/baseline.js";
import { evaluateSelectedBindings, exportRulesSelecting } from "../../core/exports.js";
import { evaluateSelectedEdge, rulesSelecting } from "../../core/imports.js";
import { evaluateMemberSite, memberRulesSelecting } from "../../core/members.js";
import { evaluateStructure, requiredSiblingsOf } from "../../core/structure.js";
import { fingerprintOf, formatMessage, type Violation } from "../../domain/violation.js";
import { type LoadedPolicy, loadPolicy } from "../oxlint/config-loader.js";
import { sourceFactsOf } from "./source-facts.js";
import { listSourceFiles } from "./source-files.js";

// The policy, run with no linter in the loop.
//
// oxlint's JS plugin API is alpha, and a policy that can only be evaluated by
// one alpha host is a policy with a single point of failure. This adapter is the
// second way to ask the same question — and the only way to write a baseline,
// since that needs every finding at once rather than one file at a time.
//
// It covers all four families. The two that need a syntax tree read TypeScript's
// rather than oxlint's; both adapters meet at the same vocabulary — a specifier,
// a binding, a member site — so they answer to the same core rather than to each
// other.

export type CliFailure = { readonly _tag: "CliFailure"; readonly message: string };

const fail = (message: string): CliFailure => ({ _tag: "CliFailure", message });

export type Findings = {
  readonly violations: ReadonlyArray<Violation>;
  readonly unresolved: ReadonlyArray<string>;
  readonly files: number;
};

export const collectFindings = (policy: LoadedPolicy, roots: ReadonlyArray<string>): Findings => {
  const files = listSourceFiles(policy.repoRoot, roots);
  const violations: Array<Violation> = [];
  const unresolved: Array<string> = [];

  for (const file of files) {
    for (const violation of evaluateStructure(policy.structure, policy.fileSystem, file)) {
      violations.push(violation);
    }

    const selectedImports = rulesSelecting(policy.importRules, file);
    const selectedExports = exportRulesSelecting(policy.exportRules, file);
    const selectedMembers = memberRulesSelecting(policy.memberRules, file);
    if (selectedImports.length + selectedExports.length + selectedMembers.length === 0) continue;

    const facts = sourceFactsOf(policy.repoRoot, file);

    for (const site of facts.memberSites) {
      for (const violation of evaluateMemberSite(selectedMembers, site)) violations.push(violation);
    }

    for (const specifier of facts.specifiers) {
      const edge = { importer: file, specifier };

      const imported = evaluateSelectedEdge(selectedImports, policy.resolver, edge);
      if (Result.isFailure(imported)) {
        if (policy.config.resolve.unresolved === "off") continue;
        if (policy.ignoreUnresolved.some((pattern) => pattern.test(specifier))) continue;
        unresolved.push(`${file} → ${specifier} (${imported.failure.detail})`);
        continue;
      }
      for (const violation of imported.success) violations.push(violation);

      const bound = facts.bindings.get(specifier) ?? [];
      const exported = evaluateSelectedBindings(selectedExports, policy.resolver, {
        ...edge,
        bindings: bound,
      });
      if (!Result.isFailure(exported)) {
        for (const { violation } of exported.success) violations.push(violation);
      }
    }
  }

  return { violations, unresolved, files: files.length };
};

const baselinePathOf = (policy: LoadedPolicy): string | null =>
  policy.config.baseline === undefined
    ? null
    : path.resolve(policy.repoRoot, policy.config.baseline);

const readBaseline = (policy: LoadedPolicy): Baseline => {
  const at = baselinePathOf(policy);
  if (at === null) return EMPTY_BASELINE;
  try {
    return decodeBaseline(JSON.parse(readFileSync(at, "utf8")) as unknown);
  } catch {
    return EMPTY_BASELINE;
  }
};

const report = (lines: ReadonlyArray<string>): Effect.Effect<void> =>
  Effect.sync(() => {
    for (const line of lines) process.stdout.write(`${line}\n`);
  });

const describe = (violation: Violation): string =>
  `  ${violation.file}\n      ${formatMessage(violation)}`;

export const check = (
  policy: LoadedPolicy,
  roots: ReadonlyArray<string>,
): Effect.Effect<void, CliFailure> =>
  Effect.gen(function* () {
    const findings = collectFindings(policy, roots);
    const baseline = readBaseline(policy);
    const reportable = unbaselined(baseline, findings.violations);
    const stale = staleEntriesOf(baseline, findings.violations);

    yield* report(reportable.map(describe));
    yield* report(findings.unresolved.map((one) => `  unresolved: ${one}`));

    const carried = findings.violations.length - reportable.length;
    yield* report([
      "",
      `${String(findings.files)} files, ${String(reportable.length)} violations` +
        (carried > 0 ? `, ${String(carried)} carried by the baseline` : ""),
    ]);

    if (stale.length > 0) {
      // The ratchet: a fixed violation must leave the baseline, or the floor
      // never rises and the file stops describing anything real.
      yield* report([
        "",
        `${String(stale.length)} baseline entries no longer fire. The code was fixed; prune them:`,
        ...stale.map((entry) => `  ${entry}`),
        "",
        "  architecture baseline    # rewrites the file from what still fires",
      ]);
      return yield* Effect.fail(fail("stale baseline entries"));
    }

    if (reportable.length > 0 || findings.unresolved.length > 0) {
      return yield* Effect.fail(fail("architecture violations"));
    }
  });

export const writeBaseline = (
  policy: LoadedPolicy,
  roots: ReadonlyArray<string>,
): Effect.Effect<void, CliFailure> =>
  Effect.gen(function* () {
    const at = baselinePathOf(policy);
    if (at === null) {
      return yield* Effect.fail(
        fail("this policy declares no `baseline` path, so there is nowhere to write one"),
      );
    }

    const findings = collectFindings(policy, roots);
    const baseline = baselineOf(findings.violations);
    yield* Effect.sync(() => {
      writeFileSync(at, serializeBaseline(baseline));
    });
    yield* report([
      `${String(baseline.entries.length)} violations recorded in ${path.relative(policy.repoRoot, at)}.`,
      "Each one is debt the policy is carrying. Fixing one means deleting its line.",
    ]);
  });

// The question a tree config makes harder to answer than a flat one: given a
// file, what governs it? A flat config you grep; a tree you have to walk.
export const explain = (policy: LoadedPolicy, file: string): Effect.Effect<void, CliFailure> =>
  Effect.gen(function* () {
    const relative = path.relative(policy.repoRoot, path.resolve(policy.repoRoot, file));
    const selected = rulesSelecting(policy.importRules, relative);

    // An allowlist rule names no `to` — it fires when the target matches none of
    // its patterns. A prohibition names one.
    const allowlists = selected.filter(([rule]) => rule.to.length === 0 && rule.toNot.length > 0);
    const prohibitions = selected.filter(([rule]) => rule.to.length > 0);

    const owed = policy.structure.parity
      .filter(
        (rule) =>
          rule.file.some((pattern) => pattern.test(relative)) &&
          !rule.fileNot.some((pattern) => pattern.test(relative)),
      )
      .flatMap((rule) => requiredSiblingsOf(rule, relative));

    const governing = policy.structure.folders.filter((rule) =>
      rule.folder.some((pattern) => pattern.test(path.dirname(relative))),
    );

    const naming = policy.structure.naming.filter(
      (rule) =>
        rule.file.some((pattern) => pattern.test(relative)) &&
        !rule.fileNot.some((pattern) => pattern.test(relative)),
    );

    const firstSentence = (message: string) => `${message.split(". ")[0] ?? message}.`;

    yield* report([
      relative,
      "",
      allowlists.length === 0
        ? "  may import: anything (no tier above this file states an allowlist)"
        : "  may import:",
      ...allowlists.flatMap(([rule]) => [
        `    — ${rule.name}`,
        ...rule.toNot.map((pattern) => `        ${pattern}`),
      ]),
      "",
      "  may not import:",
      ...(prohibitions.length === 0
        ? ["    (nothing beyond the allowlist above)"]
        : prohibitions.map(([rule]) => `    ${rule.name} — ${firstSentence(rule.message)}`)),
      "",
      `  lives in: ${governing.length === 0 ? "a folder no rule governs" : governing.map((rule) => rule.name).join(", ")}`,
      ...(naming.length === 0
        ? []
        : [
            "  is named by:",
            ...naming.map(
              (rule) =>
                `    ${rule.name} — ${rule.sameAs !== null ? "its folder's own name" : (rule.convention?.source ?? "")}`,
            ),
          ]),
      ...(owed.length === 0 ? [] : ["  owes:", ...owed.map((one) => `    ${one}`)]),
    ]);
  });

export const run = (
  repoRoot: string,
  argv: ReadonlyArray<string>,
): Effect.Effect<void, CliFailure> =>
  Effect.gen(function* () {
    const [command = "check", ...rest] = argv;
    const policy = yield* Effect.tryPromise({
      try: () => loadPolicy(repoRoot),
      catch: (cause) => fail(String(cause)),
    });

    const roots = rest.length > 0 ? rest : ["packages"];

    switch (command) {
      case "check":
        return yield* check(policy, roots);
      case "baseline":
        return yield* writeBaseline(policy, roots);
      case "explain": {
        const [file] = rest;
        if (file === undefined) return yield* Effect.fail(fail("explain needs a file path"));
        return yield* explain(policy, file);
      }
      default:
        return yield* Effect.fail(
          fail(`unknown command "${command}". Try: check | baseline | explain <file>`),
        );
    }
  });

export const fingerprint = fingerprintOf;
