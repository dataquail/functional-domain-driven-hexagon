import type * as Result from "effect/Result";

import type { ImportUnresolved } from "../domain/architecture-error.js";

export type DependencyKind = "local" | "external" | "builtin";

export type ResolvedTarget = {
  // Repo-relative with forward slashes for a file on disk (including one under
  // `node_modules/`), or `node:<name>` for a runtime builtin. This is the exact
  // vocabulary dependency-cruiser reports in, so ported `to` patterns — including
  // `/node_modules/effect/` against a pnpm `.pnpm/…` path — match unchanged.
  readonly path: string;
  // `builtin` is its own kind rather than a flavour of external, because a rule
  // that fences off npm dependencies is not talking about `node:crypto`.
  readonly kind: DependencyKind;
};

export type ModuleResolver = {
  readonly resolve: (
    fromFile: string,
    specifier: string,
  ) => Result.Result<ResolvedTarget, ImportUnresolved>;
};
