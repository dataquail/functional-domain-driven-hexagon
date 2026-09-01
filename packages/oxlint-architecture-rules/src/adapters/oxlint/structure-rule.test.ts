import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as Result from "effect/Result";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { EMPTY_BASELINE, makeBaselineFilter } from "../../core/baseline.js";
import { compileStructure } from "../../core/structure.js";
import { makeFileSystemFake } from "../../infrastructure/file-system-fake.js";
import { makeModuleResolverFake } from "../../infrastructure/module-resolver-fake.js";
import type { LoadedPolicy } from "./config-loader.js";
import { makeStructureRule } from "./structure-rule.js";

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MOD = "^packages/server/src/modules/[^/]+";

const config = {
  resolve: { scopes: [{ files: "", tsconfig: "tsconfig.resolve.json" }] },
  structure: {
    roots: [
      {
        name: "server-module-taxonomy",
        message: "This folder is not part of the taxonomy.",
        probe: { path: "packages/server/src/modules/alpha/helpers/probe.ts" },
        path: `${MOD}/`,
      },
    ],
    folders: [
      {
        name: "commands-folder",
        message: "commands/ holds a *.command.ts and its *.handler.ts.",
        probe: { path: "packages/server/src/modules/alpha/commands/stray.ts" },
        folder: `${MOD}/commands$`,
        files: ["\\.command\\.ts$", "\\.handler\\.ts$", "\\.test\\.tsx?$"],
      },
    ],
    parity: [
      {
        name: "command-handler-test",
        message: "Every command handler needs a sibling test.",
        probe: { path: "packages/server/src/modules/alpha/commands/do-thing.handler.ts" },
        file: `${MOD}/commands/[^/]+\\.handler\\.ts$`,
        requires: ["{base}.test.ts"],
      },
    ],
  },
};

const HANDLER = "packages/server/src/modules/todos/commands/create-todo.handler.ts";

const policy = (present: ReadonlyArray<string>): LoadedPolicy => {
  const structure = compileStructure(config.structure);
  if (Result.isFailure(structure)) throw structure.failure;
  return {
    repoRoot,
    config: { resolve: config.resolve, tree: {} },
    importRules: [],
    exportRules: [],
    memberRules: [],
    structure: structure.success,
    fileSystem: makeFileSystemFake(present),
    resolver: makeModuleResolverFake({}),
    ignoreUnresolved: [],
    baseline: makeBaselineFilter(EMPTY_BASELINE),
  };
};

const absolute = (file: string) => path.join(repoRoot, file);
const SOURCE = "export const probe = 1;\n";

// The taxonomy is a property of the path, not the syntax, so the whole check runs
// in `before` — these cases exist to prove that plumbing reports at all.
new RuleTester({ cwd: repoRoot }).run(
  "structure",
  makeStructureRule(policy([`${HANDLER.slice(0, -3)}.test.ts`])),
  {
    valid: [{ code: SOURCE, filename: absolute(HANDLER) }],
    invalid: [
      {
        code: SOURCE,
        filename: absolute("packages/server/src/modules/todos/commands/helpers.ts"),
        errors: [{ message: /^\[commands-folder\]/ }],
      },
      {
        code: SOURCE,
        filename: absolute("packages/server/src/modules/todos/helpers/thing.ts"),
        errors: [{ message: /^\[server-module-taxonomy\]/ }],
      },
    ],
  },
);

new RuleTester({ cwd: repoRoot }).run(
  "structure (no siblings on disk)",
  makeStructureRule(policy([])),
  {
    valid: [{ code: SOURCE, filename: absolute("packages/server/src/platform/ids/user-id.ts") }],
    invalid: [
      {
        code: SOURCE,
        filename: absolute(HANDLER),
        errors: [{ message: /^\[command-handler-test\]/ }],
      },
    ],
  },
);
