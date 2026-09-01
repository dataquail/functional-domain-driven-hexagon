import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as Result from "effect/Result";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { compileExportRules } from "../../core/exports.js";
import { EMPTY_STRUCTURE } from "../../core/structure.js";
import { makeFileSystemFake } from "../../infrastructure/file-system-fake.js";
import { makeModuleResolverFake } from "../../infrastructure/module-resolver-fake.js";
import type { LoadedPolicy } from "./config-loader.js";
import { makeExportsRule } from "./exports-rule.js";

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

const CQRS_BARREL =
  "node_modules/.pnpm/@effect-server-utils+cqrs/node_modules/@effect-server-utils/cqrs/dist/esm/index.js";
const EFFECT_BARREL = "node_modules/.pnpm/effect@4.0.0-beta.94/node_modules/effect/dist/index.js";

const config = {
  resolve: { scopes: [{ files: "", tsconfig: "tsconfig.resolve.json" }] },
  exports: [
    {
      name: "bus-factories-at-composition-roots",
      message: "Only a composition root may build a bus.",
      probe: {
        from: "packages/server/src/modules/todos/commands/probe.handler.ts",
        to: CQRS_BARREL,
        symbol: "makeCommandBus",
      },
      from: "^packages/server/src/",
      fromNot: "^packages/server/src/cqrs-runtime\\.ts$",
      to: "/node_modules/@effect-server-utils/cqrs/",
      symbols: ["makeCommandBus"],
    },
    {
      name: "no-effect-namespace-imports",
      message: "Import the module by its own subpath as a namespace.",
      probe: { from: "packages/server/src/probe.ts", to: EFFECT_BARREL, symbol: "Effect" },
      from: "^packages/",
      to: "/node_modules/effect/dist/index\\.js$",
      fix: "subpath-namespace-import" as const,
    },
  ],
};

const policy = (): LoadedPolicy => {
  const exportRules = compileExportRules(config.exports);
  if (Result.isFailure(exportRules)) throw exportRules.failure;
  return {
    repoRoot,
    config: { resolve: config.resolve, tree: {} },
    importRules: [],
    exportRules: exportRules.success,
    memberRules: [],
    structure: EMPTY_STRUCTURE,
    fileSystem: makeFileSystemFake([]),
    resolver: makeModuleResolverFake({
      "@effect-server-utils/cqrs": CQRS_BARREL,
      effect: EFFECT_BARREL,
      "effect/Effect": "node_modules/.pnpm/effect@4.0.0-beta.94/node_modules/effect/dist/Effect.js",
    }),
    ignoreUnresolved: [],
  };
};

const HANDLER = path.join(
  repoRoot,
  "packages/server/src/modules/todos/commands/create-todo.handler.ts",
);
const COMPOSITION_ROOT = path.join(repoRoot, "packages/server/src/cqrs-runtime.ts");

new RuleTester({ cwd: repoRoot }).run("exports", makeExportsRule(policy()), {
  valid: [
    { code: 'import { CommandBus } from "@effect-server-utils/cqrs";', filename: HANDLER },
    {
      code: 'import { makeCommandBus } from "@effect-server-utils/cqrs";',
      filename: COMPOSITION_ROOT,
    },
    { code: 'import * as Effect from "effect/Effect";', filename: HANDLER },
    // An unresolvable specifier is `architecture/imports`' diagnostic to report;
    // reporting it twice for one broken import helps nobody.
    { code: 'import { anything } from "@org/nowhere";', filename: HANDLER },
  ],
  invalid: [
    {
      code: 'import { makeCommandBus } from "@effect-server-utils/cqrs";',
      filename: HANDLER,
      errors: [{ message: /^\[bus-factories-at-composition-roots\]/ }],
    },
    {
      code: 'import { Effect } from "effect";',
      filename: HANDLER,
      errors: [{ message: /^\[no-effect-namespace-imports\]/ }],
      output: 'import * as Effect from "effect/Effect";',
    },
    {
      // The alias has to survive the rewrite, or the fix breaks every use site.
      code: 'import { Effect, Layer as L } from "effect";',
      filename: HANDLER,
      errors: [{ message: /^\[no-effect-namespace-imports\]/ }],
      output: 'import * as Effect from "effect/Effect";\nimport * as L from "effect/Layer";',
    },
    {
      // Mixed with a default import: reported, but deliberately not rewritten —
      // that fix would need comma surgery inside the braces.
      code: 'import def, { Effect } from "effect";',
      filename: HANDLER,
      errors: [{ message: /^\[no-effect-namespace-imports\]/ }],
      output: null,
    },
  ],
});
