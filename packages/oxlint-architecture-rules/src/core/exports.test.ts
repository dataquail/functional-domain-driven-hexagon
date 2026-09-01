import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import type { ExportRule } from "../domain/architecture-config.js";
import { makeModuleResolverFake } from "../infrastructure/module-resolver-fake.js";
import {
  type Binding,
  compileExportRules,
  evaluateBindingEdge,
  exportRulesFailingTheirProbe,
} from "./exports.js";

const CQRS_BARREL =
  "node_modules/.pnpm/@effect-server-utils+cqrs/node_modules/@effect-server-utils/cqrs/dist/esm/index.js";
const EFFECT_BARREL = "node_modules/.pnpm/effect@4.0.0-beta.94/node_modules/effect/dist/index.js";
const EFFECT_MODULE = "node_modules/.pnpm/effect@4.0.0-beta.94/node_modules/effect/dist/Effect.js";

const resolver = makeModuleResolverFake({
  "@effect-server-utils/cqrs": CQRS_BARREL,
  effect: EFFECT_BARREL,
  "effect/Effect": EFFECT_MODULE,
});

const compile = (rules: ReadonlyArray<ExportRule>) => {
  const compiled = compileExportRules(rules);
  if (Result.isFailure(compiled)) throw compiled.failure;
  return compiled.success;
};

const named = (...symbols: ReadonlyArray<string>): ReadonlyArray<Binding> =>
  symbols.map((symbol) => ({ symbol, kind: "named" }) as const);

const violationsOf = (
  rules: ReadonlyArray<ExportRule>,
  importer: string,
  specifier: string,
  bindings: ReadonlyArray<Binding>,
) => {
  const outcome = evaluateBindingEdge(compile(rules), resolver, { importer, specifier, bindings });
  if (Result.isFailure(outcome)) throw outcome.failure;
  return outcome.success.map(({ violation }) => violation.ruleName);
};

const busFactories: ExportRule = {
  name: "bus-factories-at-composition-roots",
  message: "Only a composition root may build a bus.",
  probe: {
    from: "packages/server/src/modules/todos/commands/probe.handler.ts",
    to: CQRS_BARREL,
    symbol: "makeCommandBus",
  },
  from: "^packages/server/src/",
  fromNot: ["^packages/server/src/cqrs-runtime\\.ts$", "\\.test\\.ts$"],
  to: "/node_modules/@effect-server-utils/(cqrs|unit-of-work)/",
  symbols: ["makeCommandBus", "makeQueryBus"],
};

const HANDLER = "packages/server/src/modules/todos/commands/create-todo.handler.ts";

describe("evaluateBindingEdge", () => {
  // The reason this is not a path rule: every importer of the barrel resolves to
  // the same file, so only the imported name can tell a factory from a Tag.
  it("reports a restricted symbol", () => {
    expect(
      violationsOf([busFactories], HANDLER, "@effect-server-utils/cqrs", named("makeCommandBus")),
    ).toEqual(["bus-factories-at-composition-roots"]);
  });

  it("allows an unrestricted symbol from the very same module", () => {
    expect(
      violationsOf([busFactories], HANDLER, "@effect-server-utils/cqrs", named("CommandBus")),
    ).toEqual([]);
  });

  it("reports once per restricted symbol when the rule carries no fix", () => {
    expect(
      violationsOf(
        [busFactories],
        HANDLER,
        "@effect-server-utils/cqrs",
        named("makeCommandBus", "makeQueryBus", "CommandBus"),
      ),
    ).toEqual(["bus-factories-at-composition-roots", "bus-factories-at-composition-roots"]);
  });

  it("exempts an importer matched by fromNot", () => {
    expect(
      violationsOf(
        [busFactories],
        "packages/server/src/cqrs-runtime.ts",
        "@effect-server-utils/cqrs",
        named("makeCommandBus"),
      ),
    ).toEqual([]);
  });

  describe("with no symbols listed", () => {
    // "any named import from this module", which is how a rule bans a binding
    // form rather than a name.
    const barrelBan: ExportRule = {
      name: "no-effect-namespace-imports",
      message: "Import the module by its own subpath instead.",
      probe: { from: "packages/server/src/probe.ts", to: EFFECT_BARREL, symbol: "Effect" },
      from: "^packages/",
      to: "/node_modules/effect/dist/index\\.js$",
      fix: "subpath-namespace-import",
    };

    it("reports any named import from the barrel", () => {
      expect(violationsOf([barrelBan], HANDLER, "effect", named("Layer"))).toEqual([
        "no-effect-namespace-imports",
      ]);
    });

    it("groups a declaration into one report when the rule carries a fix", () => {
      expect(violationsOf([barrelBan], HANDLER, "effect", named("Effect", "Layer"))).toEqual([
        "no-effect-namespace-imports",
      ]);
    });

    it("leaves the subpath form the rule steers toward alone", () => {
      expect(violationsOf([barrelBan], HANDLER, "effect/Effect", named("Effect"))).toEqual([]);
    });

    it("leaves a namespace import of the barrel alone, since kinds defaults to named", () => {
      expect(
        violationsOf([barrelBan], HANDLER, "effect", [{ symbol: "*", kind: "namespace" }]),
      ).toEqual([]);
    });
  });

  it("propagates an unresolved specifier rather than passing it", () => {
    const outcome = evaluateBindingEdge(compile([busFactories]), resolver, {
      importer: HANDLER,
      specifier: "@org/nowhere",
      bindings: named("makeCommandBus"),
    });
    expect(Result.isFailure(outcome)).toBe(true);
  });
});

describe("exportRulesFailingTheirProbe", () => {
  it("passes a rule that reports its own probe", () => {
    expect(exportRulesFailingTheirProbe(compile([busFactories]))).toEqual([]);
  });

  it("catches a rule whose symbol list no longer covers its probe", () => {
    const drifted: ExportRule = { ...busFactories, symbols: ["makeQueryBus"] };
    expect(exportRulesFailingTheirProbe(compile([drifted])).map((rule) => rule.name)).toEqual([
      "bus-factories-at-composition-roots",
    ]);
  });

  it("catches a rule whose target no longer covers its probe", () => {
    const drifted: ExportRule = { ...busFactories, to: "/node_modules/never-matches/" };
    expect(exportRulesFailingTheirProbe(compile([drifted])).map((rule) => rule.name)).toEqual([
      "bus-factories-at-composition-roots",
    ]);
  });

  it("catches a rule whose kinds no longer cover its probe", () => {
    const drifted: ExportRule = { ...busFactories, kinds: ["namespace"] };
    expect(exportRulesFailingTheirProbe(compile([drifted])).map((rule) => rule.name)).toEqual([
      "bus-factories-at-composition-roots",
    ]);
  });
});

describe("compileExportRules", () => {
  const broken = "^packages/(unclosed";

  // A pattern that cannot compile has to surface as a failure, not as a rule
  // that silently restricts nothing.
  it.each([
    ["from", { from: broken }],
    ["fromNot", { fromNot: [broken] }],
    ["to", { to: broken }],
    ["toNot", { toNot: [broken] }],
  ])("refuses an invalid pattern in %s", (field, override) => {
    const compiled = compileExportRules([{ ...busFactories, ...override }]);
    expect(Result.isFailure(compiled) && compiled.failure.field).toBe(field);
  });
});

describe("backreferences in a `to` pattern", () => {
  // A rule whose `from` declares no capture still has to evaluate: there is
  // nothing to substitute, and the target is matched as written.
  const noCapture: ExportRule = {
    ...busFactories,
    from: "^packages/server/src/",
    to: "/node_modules/@effect-server-utils/cqrs/",
  };

  it("matches a target when the rule's from side captured nothing", () => {
    expect(
      violationsOf([noCapture], HANDLER, "@effect-server-utils/cqrs", named("makeCommandBus")),
    ).toEqual(["bus-factories-at-composition-roots"]);
  });
});

describe("exportRulesFailingTheirProbe", () => {
  // A probe the rule's own `from` side does not select is a probe the rule can
  // never fail, which is the vacuity the guard exists to catch.
  it("fails a rule whose probe importer its own from side rejects", () => {
    const unselectable: ExportRule = {
      ...busFactories,
      probe: { ...busFactories.probe, from: "packages/web/features/todos/todos.view.tsx" },
    };

    expect(exportRulesFailingTheirProbe(compile([unselectable])).map((rule) => rule.name)).toEqual([
      "bus-factories-at-composition-roots",
    ]);
  });
});
