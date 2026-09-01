import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as Result from "effect/Result";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { EMPTY_BASELINE, makeBaselineFilter } from "../../core/baseline.js";
import { compileImportRules } from "../../core/imports.js";
import { EMPTY_STRUCTURE } from "../../core/structure.js";
import { makeFileSystemFake } from "../../infrastructure/file-system-fake.js";
import { makeModuleResolverFake } from "../../infrastructure/module-resolver-fake.js";
import type { LoadedPolicy } from "./config-loader.js";
import { makeImportsRule } from "./imports-rule.js";

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

const config = {
  resolve: {
    scopes: [{ files: "", tsconfig: "tsconfig.resolve.json" }],
    unresolved: "error" as const,
  },
  imports: [
    {
      name: "domain-isolation",
      message: "domain/ may only reach the contracts tier.",
      probe: {
        from: "packages/server/src/modules/todos/domain/todo/todo.root.ts",
        to: "packages/database/src/index.ts",
      },
      from: "^packages/server/src/modules/[^/]+/domain/",
      to: "^packages/",
      toNot: ["^packages/server/src/modules/[^/]+/domain/", "^packages/contracts/src/"],
    },
  ],
};

const makePolicy = (): LoadedPolicy => {
  const importRules = compileImportRules(config.imports);
  if (Result.isFailure(importRules)) throw importRules.failure;
  return {
    repoRoot,
    config: { resolve: config.resolve, tree: {} },
    importRules: importRules.success,
    exportRules: [],
    memberRules: [],
    structure: EMPTY_STRUCTURE,
    fileSystem: makeFileSystemFake([]),
    resolver: makeModuleResolverFake({
      "@org/database": "packages/database/src/index.ts",
      "@org/contracts/Policy": "packages/contracts/src/Policy.ts",
    }),
    ignoreUnresolved: [],
    baseline: makeBaselineFilter(EMPTY_BASELINE),
  };
};

const DOMAIN_FILE = path.join(
  repoRoot,
  "packages/server/src/modules/todos/domain/todo/todo.root.ts",
);
const COMMAND_FILE = path.join(
  repoRoot,
  "packages/server/src/modules/todos/commands/create-todo.handler.ts",
);

new RuleTester({ cwd: repoRoot }).run("imports", makeImportsRule(makePolicy()), {
  valid: [
    { code: 'import { Policy } from "@org/contracts/Policy";', filename: DOMAIN_FILE },
    // Selected by no rule, so the file is skipped before any resolution happens.
    { code: 'import { Database } from "@org/database";', filename: COMMAND_FILE },
  ],
  invalid: [
    {
      code: 'import { Database } from "@org/database";',
      filename: DOMAIN_FILE,
      errors: [{ message: /^\[domain-isolation\] domain\/ may only reach/ }],
    },
    {
      code: 'export * from "@org/database";',
      filename: DOMAIN_FILE,
      errors: [{ message: /^\[domain-isolation\]/ }],
    },
    {
      // The anti-vacuity guard: an import the resolver cannot place must be
      // reported, not skipped, or every rule about that target goes quiet.
      code: 'import { x } from "@org/nowhere";',
      filename: DOMAIN_FILE,
      errors: [{ message: /^\[unresolved-import\]/ }],
    },
  ],
});

// `resolve.unresolved: "off"` silences the unresolved diagnostic without
// disabling the rules themselves. RuleTester registers its own suites, so this
// runs at module level — inside an `it()` the cases would never execute.
new RuleTester({ cwd: repoRoot }).run(
  "imports (unresolved: off)",
  makeImportsRule({
    ...makePolicy(),
    config: { resolve: { ...config.resolve, unresolved: "off" as const }, tree: {} },
  }),
  {
    valid: [{ code: 'import { x } from "@org/nowhere";', filename: DOMAIN_FILE }],
    invalid: [
      {
        code: 'import { Database } from "@org/database";',
        filename: DOMAIN_FILE,
        errors: [{ message: /^\[domain-isolation\]/ }],
      },
    ],
  },
);

const DOMAIN_RELATIVE = "packages/server/src/modules/todos/domain/todo/todo.root.ts";

new RuleTester({ cwd: repoRoot }).run(
  "imports (edges the rule steps over)",
  makeImportsRule({ ...makePolicy(), ignoreUnresolved: [/^virtual:/] }),
  {
    valid: [
      // An export declaration that names no module is not an edge.
      { code: "export const x = 1;", filename: DOMAIN_FILE },
      // An unresolvable specifier the policy lists as expected.
      { code: 'import { x } from "virtual:generated";', filename: DOMAIN_FILE },
    ],
    invalid: [],
  },
);

// A baselined violation still fires inside the core; the adapter is what stays
// quiet about it.
new RuleTester({ cwd: repoRoot }).run(
  "imports (baselined)",
  makeImportsRule({
    ...makePolicy(),
    baseline: makeBaselineFilter({
      version: 1,
      entries: [`import|domain-isolation|${DOMAIN_RELATIVE}|packages/database/src/index.ts`],
    }),
  }),
  {
    valid: [{ code: 'import { Database } from "@org/database";', filename: DOMAIN_FILE }],
    invalid: [],
  },
);
