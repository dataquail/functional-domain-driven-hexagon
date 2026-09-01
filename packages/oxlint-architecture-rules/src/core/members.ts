import * as Result from "effect/Result";

import type { MemberProbe, MemberRule, MemberSubject } from "../domain/architecture-config.js";
import type { PatternInvalid } from "../domain/architecture-error.js";
import type { Violation } from "../domain/violation.js";
import { compilePatterns, firstFromMatch } from "./patterns.js";

export type CompiledMemberRule = {
  readonly name: string;
  readonly message: string;
  readonly from: ReadonlyArray<RegExp>;
  readonly fromNot: ReadonlyArray<RegExp>;
  readonly subject: MemberSubject;
  readonly in: ReadonlyArray<RegExp>;
  readonly match: ReadonlyArray<RegExp>;
  readonly matchNot: ReadonlyArray<RegExp>;
  readonly allow: ReadonlyArray<RegExp>;
  readonly probe: MemberProbe;
};

export const compileMemberRule = (
  rule: MemberRule,
): Result.Result<CompiledMemberRule, PatternInvalid> => {
  const fields = [
    ["from", rule.from],
    ["fromNot", rule.fromNot],
    ["in", rule.in],
    ["match", rule.match],
    ["matchNot", rule.matchNot],
    ["allow", rule.allow],
  ] as const;

  const compiled: Array<ReadonlyArray<RegExp>> = [];
  for (const [field, patterns] of fields) {
    const one = compilePatterns(rule.name, field, patterns);
    if (Result.isFailure(one)) return Result.fail(one.failure);
    compiled.push(one.success);
  }
  const [from, fromNot, inside, match, matchNot, allow] = compiled as [
    ReadonlyArray<RegExp>,
    ReadonlyArray<RegExp>,
    ReadonlyArray<RegExp>,
    ReadonlyArray<RegExp>,
    ReadonlyArray<RegExp>,
    ReadonlyArray<RegExp>,
  ];

  return Result.succeed({
    name: rule.name,
    message: rule.message,
    probe: rule.probe,
    subject: rule.subject,
    from,
    fromNot,
    in: inside,
    match,
    matchNot,
    allow,
  });
};

export const compileMemberRules = (
  rules: ReadonlyArray<MemberRule>,
): Result.Result<ReadonlyArray<CompiledMemberRule>, PatternInvalid> => {
  const compiled: Array<CompiledMemberRule> = [];
  for (const rule of rules) {
    const one = compileMemberRule(rule);
    if (Result.isFailure(one)) return Result.fail(one.failure);
    compiled.push(one.success);
  }
  return Result.succeed(compiled);
};

// One declared or called name, and the declaration it sits in (a type alias's
// name for `type-members`, absent for `calls`).
export type MemberSite = {
  readonly file: string;
  readonly subject: MemberSubject;
  readonly name: string;
  readonly in?: string;
};

const anyMatches = (patterns: ReadonlyArray<RegExp>, value: string): boolean =>
  patterns.some((pattern) => pattern.test(value));

export const memberRulesSelecting = (
  rules: ReadonlyArray<CompiledMemberRule>,
  file: string,
): ReadonlyArray<CompiledMemberRule> => rules.filter((rule) => firstFromMatch(rule, file) !== null);

const governs = (rule: CompiledMemberRule, site: MemberSite): boolean => {
  if (rule.subject !== site.subject) return false;
  if (rule.in.length > 0 && (site.in === undefined || !anyMatches(rule.in, site.in))) return false;
  if (rule.match.length > 0 && !anyMatches(rule.match, site.name)) return false;
  if (rule.matchNot.length > 0 && anyMatches(rule.matchNot, site.name)) return false;
  return true;
};

export const evaluateMemberSite = (
  selected: ReadonlyArray<CompiledMemberRule>,
  site: MemberSite,
): ReadonlyArray<Violation> => {
  const violations: Array<Violation> = [];
  for (const rule of selected) {
    if (!governs(rule, site)) continue;
    if (anyMatches(rule.allow, site.name)) continue;

    violations.push({
      kind: "member",
      ruleName: rule.name,
      message: rule.message,
      file: site.file,
      subject: site.name,
    });
  }
  return violations;
};

export const memberRulesFailingTheirProbe = (
  rules: ReadonlyArray<CompiledMemberRule>,
): ReadonlyArray<CompiledMemberRule> =>
  rules.filter((rule) => {
    const site: MemberSite = {
      file: rule.probe.from,
      subject: rule.subject,
      name: rule.probe.name,
      ...(rule.probe.in === undefined ? {} : { in: rule.probe.in }),
    };
    if (firstFromMatch(rule, site.file) === null) return true;
    return evaluateMemberSite([rule], site).length === 0;
  });
