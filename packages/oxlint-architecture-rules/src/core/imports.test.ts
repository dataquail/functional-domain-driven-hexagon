import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import type { ImportRule } from "../domain/architecture-config.js";
import { makeModuleResolverFake } from "../infrastructure/module-resolver-fake.js";
import { compileImportRules, evaluateImportEdge, rulesFailingTheirProbe } from "./imports.js";
import { kindOfPath } from "./patterns.js";

const compile = (rules: ReadonlyArray<ImportRule>) => {
  const compiled = compileImportRules(rules);
  if (Result.isFailure(compiled)) throw compiled.failure;
  return compiled.success;
};

const violationsOf = (
  rules: ReadonlyArray<ImportRule>,
  targets: Record<string, string>,
  importer: string,
  specifier: string,
) => {
  const outcome = evaluateImportEdge(compile(rules), makeModuleResolverFake(targets), {
    importer,
    specifier,
  });
  if (Result.isFailure(outcome)) throw outcome.failure;
  return outcome.success.map((violation) => violation.ruleName);
};

const isolation: ImportRule = {
  name: "domain-isolation",
  message: "domain/ may only reach the contracts tier.",
  probe: {
    from: "packages/server/src/modules/todos/domain/todo/todo.root.ts",
    to: "packages/database/src/index.ts",
  },
  from: "^packages/server/src/modules/[^/]+/domain/",
  to: "^packages/",
  toNot: ["^packages/server/src/modules/[^/]+/domain/", "^packages/contracts/src/"],
};

describe("evaluateImportEdge", () => {
  it("reports an edge whose target is outside the rule's allowlist", () => {
    expect(
      violationsOf(
        [isolation],
        { "@org/database": "packages/database/src/index.ts" },
        "packages/server/src/modules/todos/domain/todo/todo.root.ts",
        "@org/database",
      ),
    ).toEqual(["domain-isolation"]);
  });

  it("allows an edge the rule's toNot exempts", () => {
    expect(
      violationsOf(
        [isolation],
        { "@org/contracts/Policy": "packages/contracts/src/Policy.ts" },
        "packages/server/src/modules/todos/domain/todo/todo.root.ts",
        "@org/contracts/Policy",
      ),
    ).toEqual([]);
  });

  it("ignores a file the rule's from side does not select", () => {
    expect(
      violationsOf(
        [isolation],
        { "@org/database": "packages/database/src/index.ts" },
        "packages/server/src/modules/todos/commands/create-todo.handler.ts",
        "@org/database",
      ),
    ).toEqual([]);
  });

  it("exempts a file matched by fromNot", () => {
    const rule: ImportRule = { ...isolation, fromNot: "\\.test\\.ts$" };
    expect(
      violationsOf(
        [rule],
        { "@org/database": "packages/database/src/index.ts" },
        "packages/server/src/modules/todos/domain/todo/todo.root.test.ts",
        "@org/database",
      ),
    ).toEqual([]);
  });

  describe("backreferences", () => {
    // The `$1` is the whole point: the rule says "any module but the one I am
    // in", which no fixed pattern can express.
    const barrelOnly: ImportRule = {
      name: "module-barrel-only-cross-module",
      message: "Cross-module imports go through the other module's barrel.",
      probe: {
        from: "packages/server/src/modules/todos/commands/create-todo.handler.ts",
        to: "packages/server/src/modules/organization/domain/organization/organization.root.ts",
      },
      from: "^packages/server/src/modules/([^/]+)/",
      to: "^packages/server/src/modules/[^/]+/",
      toNot: ["^packages/server/src/modules/$1/", "^packages/server/src/modules/[^/]+/index\\.ts$"],
    };

    const targets = {
      own: "packages/server/src/modules/todos/domain/todo/todo.root.ts",
      foreign: "packages/server/src/modules/organization/domain/organization/organization.root.ts",
      "foreign-barrel": "packages/server/src/modules/organization/index.ts",
    };

    const from = "packages/server/src/modules/todos/commands/create-todo.handler.ts";

    it("permits reaching into the importer's own module", () => {
      expect(violationsOf([barrelOnly], targets, from, "own")).toEqual([]);
    });

    it("reports reaching into another module's internals", () => {
      expect(violationsOf([barrelOnly], targets, from, "foreign")).toEqual([
        "module-barrel-only-cross-module",
      ]);
    });

    it("permits another module's barrel", () => {
      expect(violationsOf([barrelOnly], targets, from, "foreign-barrel")).toEqual([]);
    });

    // A capture is one path segment, spliced in as data. A module named
    // `my.module` must match itself and nothing else — if the dot stayed live
    // the rule would also exempt `myXmodule`, and a segment carrying an unclosed
    // `(` would throw while compiling a pattern nobody wrote.
    it("splices a capture carrying regex metacharacters as a literal", () => {
      const inMyModule = "packages/server/src/modules/my.module/commands/x.handler.ts";
      const metacharacterTargets = {
        own: "packages/server/src/modules/my.module/domain/a.root.ts",
        lookalike: "packages/server/src/modules/myXmodule/domain/a.root.ts",
      };

      expect(violationsOf([barrelOnly], metacharacterTargets, inMyModule, "own")).toEqual([]);
      expect(violationsOf([barrelOnly], metacharacterTargets, inMyModule, "lookalike")).toEqual([
        "module-barrel-only-cross-module",
      ]);
    });

    it("does not throw on a capture that would be an invalid pattern", () => {
      const inBrokenModule = "packages/server/src/modules/a(b/commands/x.handler.ts";
      expect(
        violationsOf(
          [barrelOnly],
          { own: "packages/server/src/modules/a(b/domain/a.root.ts" },
          inBrokenModule,
          "own",
        ),
      ).toEqual([]);
    });
  });

  describe("dependencyKind", () => {
    const externalOnly: ImportRule = {
      name: "domain-no-external-beyond-effect",
      message: "domain/ may only depend on effect.",
      probe: {
        from: "packages/server/src/modules/todos/domain/todo/todo.root.ts",
        to: "node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/index.js",
      },
      from: "^packages/server/src/modules/[^/]+/domain/",
      dependencyKind: "external",
      toNot: "/node_modules/effect/",
    };

    const targets = {
      effect: "node_modules/.pnpm/effect@4.0.0-beta.94/node_modules/effect/dist/Schema.js",
      lodash: "node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/index.js",
      local: "packages/server/src/platform/ids/user-id.ts",
    };

    const from = "packages/server/src/modules/todos/domain/todo/todo.root.ts";

    it("permits the one external dependency the rule allows", () => {
      expect(violationsOf([externalOnly], targets, from, "effect")).toEqual([]);
    });

    it("reports any other external dependency", () => {
      expect(violationsOf([externalOnly], targets, from, "lodash")).toEqual([
        "domain-no-external-beyond-effect",
      ]);
    });

    it("does not apply to a local target", () => {
      expect(violationsOf([externalOnly], targets, from, "local")).toEqual([]);
    });
  });

  it("propagates an unresolved import instead of silently passing it", () => {
    const outcome = evaluateImportEdge(compile([isolation]), makeModuleResolverFake({}), {
      importer: "packages/server/src/modules/todos/domain/todo/todo.root.ts",
      specifier: "@org/nowhere",
    });
    expect(Result.isFailure(outcome)).toBe(true);
  });
});

describe("compileImportRules", () => {
  it("fails the whole config on an uncompilable pattern rather than matching nothing", () => {
    const outcome = compileImportRules([{ ...isolation, from: "^packages/(server" }]);
    expect(Result.isFailure(outcome)).toBe(true);
  });

  it("fails on an uncompilable target pattern, before any file happens to match", () => {
    const outcome = compileImportRules([{ ...isolation, toNot: ["^packages/$1/(oops"] }]);
    expect(Result.isFailure(outcome)).toBe(true);
  });
});

describe("rulesFailingTheirProbe", () => {
  it("passes a rule that reports its own probe", () => {
    expect(rulesFailingTheirProbe(compile([isolation]))).toEqual([]);
  });

  it("catches a rule whose from side no longer selects its probe", () => {
    const drifted: ImportRule = { ...isolation, from: "^packages/server/src/platform/" };
    expect(rulesFailingTheirProbe(compile([drifted])).map((rule) => rule.name)).toEqual([
      "domain-isolation",
    ]);
  });

  it("catches a rule whose exemptions have widened to swallow its probe", () => {
    const widened: ImportRule = { ...isolation, toNot: ["^packages/"] };
    expect(rulesFailingTheirProbe(compile([widened])).map((rule) => rule.name)).toEqual([
      "domain-isolation",
    ]);
  });

  it("classifies a probe target by path, so a builtin probe reaches a builtin rule", () => {
    const builtinRule: ImportRule = {
      name: "no-builtins-in-domain",
      message: "domain/ stays free of node builtins.",
      probe: {
        from: "packages/server/src/modules/todos/domain/todo/todo.root.ts",
        to: "node:crypto",
      },
      from: "^packages/server/src/modules/[^/]+/domain/",
      dependencyKind: "builtin",
    };
    expect(rulesFailingTheirProbe(compile([builtinRule]))).toEqual([]);
  });
});

describe("compileImportRules failures", () => {
  const broken = "^packages/(unclosed";

  it.each([
    ["from", { from: broken }],
    ["fromNot", { fromNot: [broken] }],
  ])("refuses an invalid pattern in %s", (field, override) => {
    const compiled = compileImportRules([{ ...isolation, ...override }]);
    expect(Result.isFailure(compiled) && compiled.failure.field).toBe(field);
  });
});

describe("probe dependency kinds", () => {
  // A probe states its target as a resolved path, so a rule that declares it is
  // about externals but probes a repo file has a probe it can never satisfy.
  it("fails a rule whose probe target is not the kind the rule is about", () => {
    const mismatched: ImportRule = {
      ...isolation,
      dependencyKind: "external",
      probe: { from: isolation.probe.from, to: "packages/database/src/index.ts" },
    };

    expect(rulesFailingTheirProbe(compile([mismatched])).map((rule) => rule.name)).toEqual([
      "domain-isolation",
    ]);
  });
});

describe("kindOfPath", () => {
  it.each([
    ["node:crypto", "builtin"],
    ["node_modules/effect/dist/index.js", "external"],
    ["packages/server/src/server.ts", "local"],
  ])("reads %s as %s", (path, kind) => {
    expect(kindOfPath(path)).toBe(kind);
  });
});
