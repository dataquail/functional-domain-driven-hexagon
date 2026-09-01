import * as Result from "effect/Result";

import type { BindingKind, ExportProbe, ExportRule } from "../domain/architecture-config.js";
import type { ImportUnresolved, PatternInvalid } from "../domain/architecture-error.js";
import type { Violation } from "../domain/violation.js";
import type { ModuleResolver } from "../ports/module-resolver.js";
import {
  compilePatterns,
  firstFromMatch,
  sourcesOf,
  targetAllowed,
  validateTargetPatterns,
} from "./patterns.js";

const DEFAULT_KINDS: ReadonlyArray<BindingKind> = ["named"];

export type CompiledExportRule = {
  readonly name: string;
  readonly message: string;
  readonly from: ReadonlyArray<RegExp>;
  readonly fromNot: ReadonlyArray<RegExp>;
  readonly to: ReadonlyArray<string>;
  readonly toNot: ReadonlyArray<string>;
  readonly symbols: ReadonlySet<string> | null;
  readonly kinds: ReadonlyArray<BindingKind>;
  readonly fix: "subpath-namespace-import" | null;
  readonly probe: ExportProbe;
};

export const compileExportRule = (
  rule: ExportRule,
): Result.Result<CompiledExportRule, PatternInvalid> => {
  const from = compilePatterns(rule.name, "from", rule.from);
  if (Result.isFailure(from)) return Result.fail(from.failure);
  const fromNot = compilePatterns(rule.name, "fromNot", rule.fromNot);
  if (Result.isFailure(fromNot)) return Result.fail(fromNot.failure);

  const targets = validateTargetPatterns(rule.name, [
    ["to", rule.to],
    ["toNot", rule.toNot],
  ]);
  if (Result.isFailure(targets)) return Result.fail(targets.failure);

  return Result.succeed({
    name: rule.name,
    message: rule.message,
    probe: rule.probe,
    from: from.success,
    fromNot: fromNot.success,
    to: sourcesOf(rule.to),
    toNot: sourcesOf(rule.toNot),
    symbols: rule.symbols === undefined ? null : new Set(rule.symbols),
    kinds: rule.kinds ?? DEFAULT_KINDS,
    fix: rule.fix ?? null,
  });
};

export const compileExportRules = (
  rules: ReadonlyArray<ExportRule>,
): Result.Result<ReadonlyArray<CompiledExportRule>, PatternInvalid> => {
  const compiled: Array<CompiledExportRule> = [];
  for (const rule of rules) {
    const one = compileExportRule(rule);
    if (Result.isFailure(one)) return Result.fail(one.failure);
    compiled.push(one.success);
  }
  return Result.succeed(compiled);
};

// One name pulled across one import edge: `import { makeCommandBus } from "…"`
// is a single binding, and so is the `Effect` in `import { Effect } from "effect"`.
export type Binding = {
  readonly symbol: string;
  readonly kind: BindingKind;
};

export type BindingEdge = {
  readonly importer: string;
  readonly specifier: string;
  readonly bindings: ReadonlyArray<Binding>;
};

export type SelectedExportRule = readonly [CompiledExportRule, RegExpExecArray];

export const exportRulesSelecting = (
  rules: ReadonlyArray<CompiledExportRule>,
  importer: string,
): ReadonlyArray<SelectedExportRule> => {
  const selected: Array<SelectedExportRule> = [];
  for (const rule of rules) {
    const captures = firstFromMatch(rule, importer);
    if (captures !== null) selected.push([rule, captures]);
  }
  return selected;
};

const covers = (rule: CompiledExportRule, binding: Binding): boolean =>
  rule.kinds.includes(binding.kind) && (rule.symbols === null || rule.symbols.has(binding.symbol));

export type ExportViolation = {
  readonly violation: Violation;
  readonly rule: CompiledExportRule;
  readonly bindings: ReadonlyArray<Binding>;
};

export const evaluateSelectedBindings = (
  selected: ReadonlyArray<SelectedExportRule>,
  resolver: ModuleResolver,
  edge: BindingEdge,
): Result.Result<ReadonlyArray<ExportViolation>, ImportUnresolved> => {
  if (selected.length === 0 || edge.bindings.length === 0) return Result.succeed([]);

  const resolved = resolver.resolve(edge.importer, edge.specifier);
  if (Result.isFailure(resolved)) return Result.fail(resolved.failure);
  const target = resolved.success;

  const violations: Array<ExportViolation> = [];
  for (const [rule, captures] of selected) {
    if (!targetAllowed(rule, captures, target.path)) continue;

    const offending = edge.bindings.filter((binding) => covers(rule, binding));
    if (offending.length === 0) continue;

    // A rule carrying a fix reports once for the whole declaration, because the
    // fix rewrites the declaration as a unit; one without reports per symbol, so
    // the diagnostic sits on the name that is actually restricted.
    const groups = rule.fix === null ? offending.map((binding) => [binding]) : [offending];
    for (const bindings of groups) {
      violations.push({
        rule,
        bindings,
        violation: {
          kind: "export",
          ruleName: rule.name,
          message: rule.message,
          file: edge.importer,
          subject: `${target.path}#${bindings.map((binding) => binding.symbol).join(",")}`,
        },
      });
    }
  }

  return Result.succeed(violations);
};

export const evaluateBindingEdge = (
  rules: ReadonlyArray<CompiledExportRule>,
  resolver: ModuleResolver,
  edge: BindingEdge,
): Result.Result<ReadonlyArray<ExportViolation>, ImportUnresolved> =>
  evaluateSelectedBindings(exportRulesSelecting(rules, edge.importer), resolver, edge);

export const exportRulesFailingTheirProbe = (
  rules: ReadonlyArray<CompiledExportRule>,
): ReadonlyArray<CompiledExportRule> =>
  rules.filter((rule) => {
    const captures = firstFromMatch(rule, rule.probe.from);
    if (captures === null) return true;
    if (!targetAllowed(rule, captures, rule.probe.to)) return true;
    return !covers(rule, {
      symbol: rule.probe.symbol,
      kind: rule.probe.kind ?? "named",
    });
  });
