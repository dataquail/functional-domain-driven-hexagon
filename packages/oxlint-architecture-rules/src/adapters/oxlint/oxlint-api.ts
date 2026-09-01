import * as path from "node:path";

import type { RuleTester } from "oxlint/plugins-dev";

// oxlint publishes no plugin types, so the exact `Context`, node and fixer shapes
// are recovered from `RuleTester`'s own signature — the one public surface that
// names them. Hand-rolling them drifts silently against an alpha API.
export type OxlintRule = Parameters<RuleTester["run"]>[1];
export type RuleContext = Parameters<Extract<OxlintRule, { createOnce: unknown }>["createOnce"]>[0];

type Diagnostic = Parameters<RuleContext["report"]>[0];
export type ReportableNode = Extract<Diagnostic, { node: unknown }>["node"];
export type Fixer = Parameters<NonNullable<Diagnostic["fix"]>>[0];

export type SourceNode = ReportableNode & {
  readonly source?: { readonly value?: unknown } | null;
};

export const toRepoRelative = (repoRoot: string, filename: string): string =>
  path.relative(repoRoot, filename).replaceAll(path.sep, "/");

export const specifierOf = (node: SourceNode): string | null => {
  const value = node.source?.value;
  return typeof value === "string" ? value : null;
};
