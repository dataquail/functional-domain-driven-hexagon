import * as Result from "effect/Result";

import { ImportUnresolved } from "../domain/architecture-error.js";
import type { ModuleResolver, ResolvedTarget } from "../ports/module-resolver.js";

// Keyed by specifier alone: a core-evaluator test states the edges it is about
// and never the resolution algorithm, which has its own tests against the real
// resolver.
export const makeModuleResolverFake = (
  targets: Readonly<Record<string, string>>,
): ModuleResolver => ({
  resolve: (fromFile, specifier) => {
    const path = targets[specifier];
    if (path === undefined) {
      return Result.fail(
        new ImportUnresolved({ fromFile, specifier, detail: "not staged in the fake" }),
      );
    }
    const target: ResolvedTarget = {
      path,
      kind: path.startsWith("node:")
        ? "builtin"
        : path.includes("node_modules/")
          ? "external"
          : "local",
    };
    return Result.succeed(target);
  },
});
