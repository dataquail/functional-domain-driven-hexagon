import { describe, expect, it } from "vitest";

import { lowerManifest } from "./compile.js";
import type { Manifest } from "./manifest.js";

const base = (tree: Manifest["tree"]): Manifest => ({
  resolve: { scopes: [{ files: "", tsconfig: "tsconfig.json" }] },
  aliases: { "@": "pkg/src" },
  tree,
});

const ruleNamed = <A extends { readonly name: string }>(
  rules: ReadonlyArray<A>,
  suffix: string,
): A => {
  const found = rules.find((rule) => rule.name.endsWith(suffix));
  if (found === undefined) throw new Error(`no rule ending in ${suffix}`);
  return found;
};

describe("multi-pattern keys", () => {
  const manifest = base({
    "@/domain/": {
      children: {
        "*.root.ts": {},
        "*.aggregate-ops.ts | *.entity-ops.ts | *.value-object-ops.ts": {
          message: "Constituent ops owe a sibling test.",
          requires: ["{base}.test.ts"],
        },
      },
    },
  });

  const lowered = lowerManifest(manifest);

  // The point of the feature: one node, one rule, every stereotype it names.
  it("emits one parity rule covering every alternative", () => {
    const parity = lowered.structure.parity;
    expect(parity).toHaveLength(1);
    const pattern = new RegExp(parity[0]?.file as string);
    expect(pattern.test("pkg/src/domain/todo.aggregate-ops.ts")).toBe(true);
    expect(pattern.test("pkg/src/domain/todo.entity-ops.ts")).toBe(true);
    expect(pattern.test("pkg/src/domain/todo.value-object-ops.ts")).toBe(true);
    expect(pattern.test("pkg/src/domain/todo.root.ts")).toBe(false);
  });

  it("admits every alternative in the folder's layout allowlist", () => {
    const folder = lowered.structure.folders[0];
    if (folder === undefined) throw new Error("no folder rule emitted");
    const admits = (basename: string) =>
      (folder.files as ReadonlyArray<string>).some((one) => new RegExp(one).test(basename));
    expect(admits("todo.aggregate-ops.ts")).toBe(true);
    expect(admits("todo.entity-ops.ts")).toBe(true);
    expect(admits("todo.value-object-ops.ts")).toBe(true);
    expect(admits("todo.helpers.ts")).toBe(false);
  });

  it("builds the probe from the first alternative, so the rule still proves itself", () => {
    expect(lowered.structure.parity[0]?.probe.path).toBe("pkg/src/domain/zz.aggregate-ops.ts");
  });

  // A capture has to come from one place, or the group numbering the IR relies
  // on stops meaning anything.
  it("refuses a key that both alternates and captures", () => {
    expect(() => lowerManifest(base({ "@/{a}/ | @/{b}/": { children: { "x.ts": {} } } }))).toThrow(
      /names several patterns and declares a capture/,
    );
  });
});

describe("sibling precedence", () => {
  // The nested config made this an ordering rule the author had to remember.
  // Here the tree shape already says it, so the compiler derives the exclusion.
  const lowered = lowerManifest(
    base({
      "@/domain/": {
        children: {
          "ports/": { children: { "*.client.ts": {} } },
          "domain-services/": { children: { "*.domain-service.ts": {} } },
          "{subdomain}/": { children: { "*.root.ts": {} } },
        },
      },
    }),
  );

  const subdomainFolder = ruleNamed(lowered.structure.folders, "/{subdomain}/layout");

  it("keeps a wildcard key from swallowing its literal siblings", () => {
    const pattern = new RegExp(subdomainFolder.folder as string);
    expect(pattern.test("pkg/src/domain/todo")).toBe(true);
    expect(pattern.test("pkg/src/domain/ports")).toBe(false);
    expect(pattern.test("pkg/src/domain/domain-services")).toBe(false);
  });
});

describe("importedBy", () => {
  const withAllow = (allow: ReadonlyArray<string>): Manifest =>
    base({
      "@/modules/{module}/": {
        children: {
          "*.root-ops.ts": {
            importedBy: { message: "Private to command handlers.", allow },
          },
        },
      },
    });

  it("compiles an allowlist that names no capture", () => {
    const lowered = lowerManifest(withAllow(["@/modules/*/commands/**"]));
    expect(ruleNamed(lowered.imports, "/imported-by").name).toContain("imported-by");
  });

  // The allowlist is matched against the IMPORTER, but the capture was declared
  // by the TARGET's path — so it would compile to a pattern that never matches
  // and the rule would over-report with an exemption that silently does nothing.
  it("refuses a capture, rather than emitting an exemption that cannot work", () => {
    expect(() => lowerManifest(withAllow(["@/modules/{module}/commands/**"]))).toThrow(
      /cannot be used there/,
    );
  });

  it("says which capture and what to do instead", () => {
    expect(() => lowerManifest(withAllow(["@/modules/{module}/commands/**"]))).toThrow(
      /\{module\}[\s\S]*Use a wildcard/,
    );
  });
});

describe("import policy scope", () => {
  const lowered = lowerManifest(
    base({
      "@/domain/": {
        imports: { message: "domain may only reach itself.", allow: ["@/domain/**"] },
        children: {
          "*.root.ts": {},
          "*.test.ts": { imports: { unrestricted: true } },
        },
      },
    }),
  );

  // Import policy is a property of a folder, so it lowers once per folder rather
  // than once per file kind in it.
  it("emits one rule for the folder, not one per file kind", () => {
    expect(lowered.imports.filter((rule) => rule.name.endsWith("/imports"))).toHaveLength(1);
  });

  it("exempts a file node that states its own policy from its folder's", () => {
    const folderRule = ruleNamed(lowered.imports, "/imports");
    const exemptions = (folderRule.fromNot ?? []) as ReadonlyArray<string>;
    expect(exemptions.some((one) => new RegExp(one).test("pkg/src/domain/todo.root.test.ts"))).toBe(
      true,
    );
    expect(exemptions.some((one) => new RegExp(one).test("pkg/src/domain/todo.root.ts"))).toBe(
      false,
    );
  });

  // A node that allows everything has no policy to prove, and emitting a rule
  // that can never report is the vacuity this package exists to prevent.
  it("emits nothing for a node whose allowlist admits everything", () => {
    expect(lowered.imports.some((rule) => rule.name.includes("*.test.ts"))).toBe(false);
  });
});

describe("reset", () => {
  const lowered = lowerManifest(
    base({
      "@/modules/{module}/": {
        imports: {
          allow: ["@/modules/{module}/**"],
          deny: [{ match: "**/*.test.ts", message: "Nothing imports a test file." }],
        },
        children: {
          "commands/": {
            imports: {
              reset: true,
              message: "commands see their own domain.",
              allow: ["@/modules/{module}/domain/**"],
            },
            children: { "*.handler.ts": {} },
          },
        },
      },
    }),
  );

  const commandsRule = ruleNamed(lowered.imports, "/commands/imports");

  it("drops the ancestor's allowances", () => {
    const allow = (commandsRule.toNot ?? []) as ReadonlyArray<string>;
    expect(allow.some((one) => one.includes("domain"))).toBe(true);
    // `@/modules/{module}/**` would have admitted queries/ and infrastructure/.
    expect(allow.some((one) => /\$1\/\.\*|\$1\(\/\.\*\)\?/.test(one))).toBe(false);
  });

  // A prohibition is emitted once, at the node that declares it, over that
  // node's whole subtree — so a descendant that resets its allowances is still
  // covered, and resetting can never make a subtree quieter than its ancestors.
  it("keeps the ancestor's prohibitions over the subtree", () => {
    const denial = ruleNamed(lowered.imports, "modules-module/deny-0");
    expect(denial.message).toBe("Nothing imports a test file.");
    expect(
      new RegExp(denial.from as string).test("pkg/src/modules/alpha/commands/do.handler.ts"),
    ).toBe(true);
  });

  it("does not restate an inherited prohibition at the descendant", () => {
    expect(lowered.imports.some((rule) => rule.name === "modules-module/commands/deny-0")).toBe(
      false,
    );
  });

  it("aims each denial's probe at the shape that denial names", () => {
    expect(ruleNamed(lowered.imports, "modules-module/deny-0").probe.to).toBe("deep/zz.test.ts");
  });
});

describe("unrestricted", () => {
  const manifest = base({
    "@/modules/{module}/": {
      imports: {
        unrestricted: true,
        deny: [{ match: "@/platform/**/*-live.ts", message: "Lives are wired at a root." }],
      },
      children: {
        "infrastructure/": {
          imports: {
            unrestricted: true,
            deny: [
              { match: "@/modules/*/interface/**", message: "No infrastructure to interface." },
            ],
          },
          children: { "*.repository-live.ts": {} },
        },
      },
    },
  });

  const lowered = lowerManifest(manifest);

  // Not tightening a tier is a decision; it should read as one.
  it("refuses an imports policy with no allowlist unless it says so", () => {
    expect(() =>
      lowerManifest(
        base({ "@/x/": { imports: { deny: [{ match: "**/*.test.ts", message: "no" }] } } }),
      ),
    ).toThrow(/say `unrestricted: true`/);
  });

  it("emits the prohibitions and no allowlist", () => {
    expect(lowered.imports.filter((rule) => rule.name.endsWith("/imports"))).toHaveLength(0);
    expect([...lowered.imports.map((rule) => rule.name)].sort()).toEqual([
      "modules-module/deny-0",
      "modules-module/infrastructure/deny-0",
    ]);
  });

  // Emitted once, over the whole subtree: a descendant neither restates it nor
  // can escape it, which is what makes `reset` unable to make a subtree quieter.
  it("scopes a prohibition to the subtree that declares it", () => {
    const rule = ruleNamed(lowered.imports, "modules-module/deny-0");
    const pattern = new RegExp(rule.from as string);
    expect(
      pattern.test("pkg/src/modules/alpha/infrastructure/repositories/x.repository-live.ts"),
    ).toBe(true);
    expect(rule.fromNot).toBeUndefined();
  });
});

describe("folder keys with alternatives", () => {
  // `"http/ | cli/"` carries a trailing slash on every alternative, so stripping
  // before splitting left `http/` with its slash and the folder never matched.
  const lowered = lowerManifest(
    base({ "@/interface/": { children: { "http/ | cli/": { children: { "index.ts": {} } } } } }),
  );

  it("governs every alternative folder", () => {
    const pattern = new RegExp(
      ruleNamed(lowered.structure.folders, "/http/layout").folder as string,
    );
    expect(pattern.test("pkg/src/interface/http")).toBe(true);
    expect(pattern.test("pkg/src/interface/cli")).toBe(true);
    expect(pattern.test("pkg/src/interface/events")).toBe(false);
  });
});

describe("requiresNot", () => {
  const lowered = lowerManifest(
    base({
      "@/http/": {
        children: {
          "*.endpoint.ts": {
            message: "Endpoints need an integration test.",
            requires: ["{base}.integration.test.ts"],
            requiresNot: ["login.endpoint.ts"],
          },
        },
      },
    }),
  );

  // The exemption sits on the obligation it exempts, rather than as a separate
  // more-specific key that has to win a precedence contest.
  it("exempts the filenames it names, and nothing else", () => {
    const rule = ruleNamed(lowered.structure.parity, "/requires");
    const exempt = (rule.fileNot ?? []) as ReadonlyArray<string>;
    expect(exempt.some((one) => new RegExp(one).test("pkg/src/http/login.endpoint.ts"))).toBe(true);
    expect(exempt.some((one) => new RegExp(one).test("pkg/src/http/create.endpoint.ts"))).toBe(
      false,
    );
  });
});

describe("prohibitions with exemptions", () => {
  const lowered = lowerManifest(
    base({
      "@/modules/{module}/": {
        imports: {
          unrestricted: true,
          deny: [
            {
              match: "@/modules/*/index.ts",
              matchNot: ["@/modules/{module}/index.ts"],
              except: ["@/modules/*/infrastructure/acl/**"],
              message: "Only an ACL adapter may name a foreign barrel.",
            },
          ],
        },
        children: {
          "infrastructure/": { children: { "acl/": { children: { "*.acl-live.ts": {} } } } },
        },
      },
    }),
  );

  const denial = ruleNamed(lowered.imports, "modules-module/deny-0");

  // The exemption is declared by the author of the prohibition, in the same
  // breath — a descendant still cannot opt itself out.
  it("exempts the importers the prohibition names", () => {
    const exempt = (denial.fromNot ?? []) as ReadonlyArray<string>;
    expect(
      exempt.some((one) =>
        new RegExp(one).test("pkg/src/modules/alpha/infrastructure/acl/beta.acl-live.ts"),
      ),
    ).toBe(true);
    expect(
      exempt.some((one) =>
        new RegExp(one).test(
          "pkg/src/modules/alpha/infrastructure/repositories/x.repository-live.ts",
        ),
      ),
    ).toBe(false);
  });

  // `{module}` resolves here because the prohibition's `from` side is this
  // node's own path, which is where the capture was declared.
  it("carves the importer's own module out of the target set", () => {
    const exceptions = (denial.toNot ?? []) as ReadonlyArray<string>;
    expect(exceptions[0]).toContain("$1");
  });
});

describe("importedBy on a folder", () => {
  const lowered = lowerManifest(
    base({
      "@/modules/{module}/": {
        importedBy: {
          message: "A module is private except through its barrel.",
          allow: ["@/modules/**"],
          matchNot: ["index.ts"],
        },
        imports: { unrestricted: true },
        children: { "index.ts": {}, "commands/": { children: { "*.handler.ts": {} } } },
      },
    }),
  );

  const rule = ruleNamed(lowered.imports, "/imported-by");

  // "A module is private" is a statement about everything under it, not about
  // the folder node itself.
  it("covers the whole subtree", () => {
    const target = new RegExp(rule.to as string);
    expect(target.test("pkg/src/modules/alpha/commands/do.handler.ts")).toBe(true);
    expect(target.test("pkg/src/modules/alpha/domain/one/one.root.ts")).toBe(true);
  });

  it("exempts the barrel it names, so the public surface stays public", () => {
    const exempt = (rule.toNot ?? []) as ReadonlyArray<string>;
    expect(exempt.some((one) => new RegExp(one).test("pkg/src/modules/alpha/index.ts"))).toBe(true);
    expect(
      exempt.some((one) => new RegExp(one).test("pkg/src/modules/alpha/commands/do.handler.ts")),
    ).toBe(false);
  });
});

describe("aliases", () => {
  it("expands an alias used as the whole pattern, not only as a prefix", () => {
    const lowered = lowerManifest({
      ...base({}),
      deny: [{ match: "@", message: "Nothing may reach the package root." }],
    });

    expect(ruleNamed(lowered.imports, "deny-0").to).toBe("^pkg/src");
  });
});

describe("a prohibition that carves targets back out", () => {
  it("lowers matchNot onto the rule's toNot", () => {
    const lowered = lowerManifest(
      base({
        "@/a/": {
          imports: {
            unrestricted: true,
            deny: [
              {
                match: "@/b/**",
                matchNot: "@/b/index.ts",
                message: "b/ is private except through its barrel.",
              },
            ],
          },
          children: { "*.ts": {} },
        },
      }),
    );

    expect(ruleNamed(lowered.imports, "a/deny-0").toNot).toEqual(["^pkg/src/b/index\\.ts"]);
  });
});

describe("export restrictions", () => {
  it("takes the first pattern of a multi-pattern module as the probe target", () => {
    const lowered = lowerManifest({
      ...base({}),
      exports: [
        {
          name: "no-factories",
          message: "A factory is built at a composition root.",
          module: ["**/node_modules/pkg/**", "**/node_modules/other/**"],
          symbols: ["makeBus"],
        },
      ],
    });

    expect(ruleNamed(lowered.exports, "no-factories").probe.to).toContain("node_modules/pkg");
  });
});

describe("naming", () => {
  const tree = (name: unknown, extra: Record<string, unknown> = {}) =>
    lowerManifest(
      base({
        "@/modules/{module}/": {
          name,
          children: {
            "domain/{subdomain}/": {
              children: { "*.root.ts": extra, "*.id.ts": {} },
            },
          },
        },
      } as never),
    );

  it("judges a folder's own segment where its key declares a capture", () => {
    const rule = ruleNamed(tree("kebab-case").structure.naming, "modules-module/naming-folder");
    expect(rule.convention).toBe("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    expect(rule.file[0]).toContain("pkg/src/modules");
  });

  // A literal key names nothing variable, so it has no segment to judge — only
  // the files inside it.
  it("emits no folder rule for a key with no variable segment", () => {
    const names = tree("kebab-case").structure.naming.map((rule) => rule.name);
    expect(names).not.toContain("modules-module/domain/{subdomain}/*.root.ts/naming-folder");
  });

  // Inheritance is the whole ergonomics: one declaration, not one per key.
  it("carries the convention down to a folder that does not restate it", () => {
    const names = tree("kebab-case").structure.naming.map((rule) => rule.name);
    expect(names).toContain("modules-module/domain/{subdomain}/naming");
  });

  it("states nothing when no tier declares a convention", () => {
    expect(tree(undefined).structure.naming).toEqual([]);
  });

  describe("named after an ancestor capture", () => {
    it("compiles to a comparison between two groups of one match", () => {
      const rule = ruleNamed(
        tree("kebab-case", { name: { like: "{subdomain}" } }).structure.naming,
        "*.root.ts/naming",
      );
      expect(rule.sameAs).toBeDefined();
      expect(rule.subject).not.toBe(rule.sameAs);
    });

    it("refuses a reference no ancestor path declares", () => {
      expect(() => tree("kebab-case", { name: { like: "{nowhere}" } })).toThrow(/no ancestor/);
    });
  });

  // A convention nothing can violate is a rule that never reports, which is the
  // one failure this package refuses to ship.
  it("refuses a custom pattern that admits every name", () => {
    expect(() => tree({ regex: ".*" })).toThrow(/admits every name/);
  });

  it("generates a probe its own convention rejects", () => {
    const rule = ruleNamed(tree("PascalCase").structure.naming, "modules-module/naming");
    expect(rule.probe.path).toMatch(/zz-probe-stray/);
  });
});

describe("naming edge cases", () => {
  const one = (node: unknown) => lowerManifest(base({ "@/a/": node } as never)).structure.naming;

  it("refuses a convention it does not know", () => {
    expect(() => one({ name: "SCREAMING_SNAKE", children: { "*.ts": {} } })).toThrow(
      /unknown naming convention/,
    );
  });

  it("carries a custom message rather than the generated one", () => {
    const [rule] = one({
      name: { regex: "^x[a-z]+$", message: "A file here starts with x." },
      children: { "*.ts": {} },
    });
    expect(rule?.message).toBe("A file here starts with x.");
  });

  it.each(["camelCase", "snake_case"])("knows the shape of %s", (convention) => {
    const [rule] = one({ name: convention, children: { "*.ts": {} } });
    expect(rule?.message).toContain(convention);
    expect(rule?.convention).toBeDefined();
  });
});
