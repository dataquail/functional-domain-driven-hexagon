import * as path from "node:path";

import * as Result from "effect/Result";
import { ResolverFactory } from "unrs-resolver";

import type { ResolveConfig } from "../domain/architecture-config.js";
import { ImportUnresolved } from "../domain/architecture-error.js";
import type { ModuleResolver, ResolvedTarget } from "../ports/module-resolver.js";

// `.js` in a NodeNext import specifier points at a `.ts` on disk. Without this,
// every relative import in the repo resolves to nothing and every path rule about
// it goes silently vacuous — the failure this package exists to make impossible.
const EXTENSION_ALIAS = {
  ".js": [".ts", ".tsx", ".js"],
  ".mjs": [".mts", ".mjs"],
  ".cjs": [".cts", ".cjs"],
};

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const DEFAULT_CONDITION_NAMES = ["import", "require", "node", "default"];
const DEFAULT_MAIN_FIELDS = ["main", "types"];

const toPosix = (value: string): string => value.replaceAll(path.sep, "/");

const toResolvedTarget = (repoRoot: string, absolutePath: string): ResolvedTarget => {
  const relative = toPosix(path.relative(repoRoot, absolutePath));
  return { path: relative, kind: relative.includes("node_modules/") ? "external" : "local" };
};

type Scope = {
  readonly matches: RegExp;
  readonly factory: ResolverFactory;
};

export const makeModuleResolverLive = (repoRoot: string, config: ResolveConfig): ModuleResolver => {
  const scopes: ReadonlyArray<Scope> = config.scopes.map((scope) => ({
    matches: new RegExp(scope.files),
    factory: new ResolverFactory({
      tsconfig: { configFile: path.resolve(repoRoot, scope.tsconfig) },
      extensions: [...(config.extensions ?? DEFAULT_EXTENSIONS)],
      extensionAlias: EXTENSION_ALIAS,
      conditionNames: [...(config.conditionNames ?? DEFAULT_CONDITION_NAMES)],
      mainFields: [...(config.mainFields ?? DEFAULT_MAIN_FIELDS)],
      builtinModules: true,
    }),
  }));

  const cache = new Map<string, Result.Result<ResolvedTarget, ImportUnresolved>>();

  const resolveUncached = (
    scope: Scope,
    fromDirectory: string,
    fromFile: string,
    specifier: string,
  ): Result.Result<ResolvedTarget, ImportUnresolved> => {
    const resolved = scope.factory.sync(fromDirectory, specifier);

    const builtin = resolved.builtin;
    if (builtin !== undefined) {
      return Result.succeed({ path: builtin.resolved, kind: "builtin" });
    }

    const resolvedPath = resolved.path;
    if (resolvedPath === undefined) {
      return Result.fail(
        new ImportUnresolved({
          fromFile,
          specifier,
          detail: resolved.error ?? "unknown resolution failure",
        }),
      );
    }

    return Result.succeed(toResolvedTarget(repoRoot, resolvedPath));
  };

  return {
    resolve: (fromFile, specifier) => {
      const scope = scopes.find((candidate) => candidate.matches.test(fromFile));
      if (scope === undefined) {
        return Result.fail(
          new ImportUnresolved({
            fromFile,
            specifier,
            detail: "no resolve scope in the architecture config matches this file",
          }),
        );
      }

      const fromDirectory = path.resolve(repoRoot, path.dirname(fromFile));
      const key = `${scope.matches.source} ${fromDirectory} ${specifier}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      const outcome = resolveUncached(scope, fromDirectory, fromFile, specifier);
      cache.set(key, outcome);
      return outcome;
    },
  };
};
