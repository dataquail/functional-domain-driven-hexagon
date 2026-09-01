import * as Result from "effect/Result";

import { patternsOf } from "../domain/architecture-config.js";
import { PatternInvalid } from "../domain/architecture-error.js";
import type { DependencyKind } from "../ports/module-resolver.js";

const BACKREFERENCE = /\$([1-9])/g;

// Validation-only stand-in so `new RegExp` sees a syntactically complete pattern
// where a backreference will later be spliced.
const withPlaceholderCaptures = (pattern: string): string => pattern.replaceAll(BACKREFERENCE, "x");

const compilePattern = (
  ruleName: string,
  field: string,
  pattern: string,
): Result.Result<RegExp, PatternInvalid> => {
  try {
    return Result.succeed(new RegExp(pattern));
  } catch (cause) {
    return Result.fail(new PatternInvalid({ ruleName, field, pattern, detail: String(cause) }));
  }
};

export const compilePatterns = (
  ruleName: string,
  field: string,
  patterns: string | ReadonlyArray<string> | undefined,
): Result.Result<ReadonlyArray<RegExp>, PatternInvalid> => {
  const sources = patterns === undefined ? [] : patternsOf(patterns);
  const compiled: Array<RegExp> = [];
  for (const source of sources) {
    const one = compilePattern(ruleName, field, source);
    if (Result.isFailure(one)) return Result.fail(one.failure);
    compiled.push(one.success);
  }
  return Result.succeed(compiled);
};

// Target patterns are compiled per edge (a `$1` is only known once the `from`
// side has matched), so they are validated separately at load. A typo in a
// `toNot` must fail the config, not lie dormant until some file happens to
// select the rule.
export const validateTargetPatterns = (
  ruleName: string,
  fields: ReadonlyArray<readonly [string, string | ReadonlyArray<string> | undefined]>,
): Result.Result<void, PatternInvalid> => {
  for (const [field, patterns] of fields) {
    const validated = compilePatterns(
      ruleName,
      field,
      patterns === undefined ? undefined : patternsOf(patterns).map(withPlaceholderCaptures),
    );
    if (Result.isFailure(validated)) return Result.fail(validated.failure);
  }
  return Result.succeed(undefined);
};

export const sourcesOf = (
  patterns: string | ReadonlyArray<string> | undefined,
): ReadonlyArray<string> => (patterns === undefined ? [] : [...patternsOf(patterns)]);

// A capture is one path segment from the importer, spliced into a target
// pattern as `$1`. It is data, not pattern syntax: a folder named `my.module`
// must match itself, not "my" plus any character plus "module".
const REGEX_METACHARACTER = /[.*+?^${}()|[\]\\]/g;

const substitute = (pattern: string, captures: RegExpExecArray): string =>
  pattern.replaceAll(BACKREFERENCE, (whole, index: string) => {
    const capture = captures[Number(index)];
    return capture === undefined ? whole : capture.replace(REGEX_METACHARACTER, "\\$&");
  });

const targetCache = new Map<string, RegExp>();

const compiledTarget = (pattern: string): RegExp => {
  const cached = targetCache.get(pattern);
  if (cached !== undefined) return cached;
  const compiled = new RegExp(pattern);
  targetCache.set(pattern, compiled);
  return compiled;
};

export const matchesAny = (
  patterns: ReadonlyArray<string>,
  captures: RegExpExecArray,
  value: string,
): boolean => patterns.some((pattern) => compiledTarget(substitute(pattern, captures)).test(value));

export type Selectable = {
  readonly from: ReadonlyArray<RegExp>;
  readonly fromNot: ReadonlyArray<RegExp>;
};

export const firstFromMatch = (rule: Selectable, importer: string): RegExpExecArray | null => {
  if (rule.fromNot.some((pattern) => pattern.test(importer))) return null;
  for (const pattern of rule.from) {
    const captures = pattern.exec(importer);
    if (captures !== null) return captures;
  }
  return null;
};

// A probe states its target as a resolved path, so its dependency kind is read
// back off that path rather than restated in the config.
export const kindOfPath = (path: string): DependencyKind =>
  path.startsWith("node:") ? "builtin" : path.includes("node_modules/") ? "external" : "local";

export type Targeted = Selectable & {
  readonly to: ReadonlyArray<string>;
  readonly toNot: ReadonlyArray<string>;
};

export const targetAllowed = (
  rule: Targeted,
  captures: RegExpExecArray,
  targetPath: string,
): boolean => {
  if (rule.to.length > 0 && !matchesAny(rule.to, captures, targetPath)) return false;
  if (rule.toNot.length > 0 && matchesAny(rule.toNot, captures, targetPath)) return false;
  return true;
};
