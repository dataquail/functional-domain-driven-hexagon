import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import type { StructureConfig, StructureNaming } from "../domain/architecture-config.js";
import { makeFileSystemFake } from "../infrastructure/file-system-fake.js";
import type { FileSystem } from "../ports/file-system.js";
import {
  type CompiledStructure,
  compileStructure,
  EMPTY_STRUCTURE,
  evaluateStructure,
  requiredSiblingsOf,
  structureRulesFailingTheirProbe,
} from "./structure.js";

const PROBE_AT = "packages/server/src/modules/alpha/domain/thing";

const MOD = "^packages/server/src/modules/[^/]+";

const config: StructureConfig = {
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
    {
      name: "domain-is-a-container",
      message: "domain/ admits no direct files.",
      probe: { path: "packages/server/src/modules/alpha/domain/stray.ts" },
      folder: `${MOD}/domain$`,
      files: [],
    },
    // The lookahead is what the nested config expressed as "specific beats the
    // `*` catch-all": `ports` is not a subdomain.
    {
      name: "subdomain-folder",
      message: "A subdomain admits its DDD stereotypes.",
      probe: { path: "packages/server/src/modules/alpha/domain/one/stray.ts" },
      folder: `${MOD}/domain/(?!ports$)[^/]+$`,
      files: ["\\.root\\.ts$", "\\.repository\\.ts$"],
    },
    {
      name: "ports-is-a-container",
      message: "ports/ admits no direct files.",
      probe: { path: "packages/server/src/modules/alpha/domain/ports/stray.ts" },
      folder: `${MOD}/domain/ports$`,
      files: [],
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
    {
      name: "repository-port-counterparts",
      message: "Every repository port needs its infrastructure trio.",
      probe: { path: "packages/server/src/modules/alpha/domain/one/one.repository.ts" },
      file: `${MOD}/domain/[^/]+/[^/]+\\.repository\\.ts$`,
      requires: [
        "../../infrastructure/repositories/{base}-live.ts",
        "../../infrastructure/repositories/{base}-fake.ts",
      ],
    },
    {
      name: "endpoint-test",
      message: "Every endpoint needs an integration test.",
      probe: { path: "packages/server/src/modules/alpha/interface/http/get-thing.endpoint.ts" },
      file: `${MOD}/interface/http/[^/]+\\.endpoint\\.ts$`,
      fileNot: ["/login\\.endpoint\\.ts$"],
      requires: ["{base}.integration.test.ts"],
    },
  ],
};

const compiled = () => {
  const outcome = compileStructure(config);
  if (Result.isFailure(outcome)) throw outcome.failure;
  return outcome.success;
};

const ALL_PRESENT: FileSystem = { exists: () => true };

const namesAt = (file: string, fileSystem: FileSystem = ALL_PRESENT) =>
  evaluateStructure(compiled(), fileSystem, file).map((violation) => violation.ruleName);

describe("evaluateStructure layout", () => {
  it("admits a file kind its folder declares", () => {
    expect(namesAt("packages/server/src/modules/todos/commands/create-todo.handler.ts")).toEqual(
      [],
    );
  });

  it("rejects a file kind its folder does not declare", () => {
    expect(namesAt("packages/server/src/modules/todos/commands/helpers.ts")).toEqual([
      "commands-folder",
    ]);
  });

  it("rejects any direct file in a container folder", () => {
    expect(namesAt("packages/server/src/modules/todos/domain/anything.ts")).toEqual([
      "domain-is-a-container",
    ]);
  });

  it("does not let a subdomain rule leak into the ports container beside it", () => {
    expect(namesAt("packages/server/src/modules/todos/domain/ports/stray.ts")).toEqual([
      "ports-is-a-container",
    ]);
  });

  // The stray-folder case: no folder rule governs it, so the root is what fires.
  it("rejects a folder the taxonomy does not know about", () => {
    expect(namesAt("packages/server/src/modules/todos/helpers/thing.ts")).toEqual([
      "server-module-taxonomy",
    ]);
  });

  it("leaves files outside every taxonomy root alone", () => {
    expect(namesAt("packages/server/src/platform/ids/user-id.ts")).toEqual([]);
  });
});

describe("evaluateStructure parity", () => {
  it("reports a file whose required sibling is absent", () => {
    expect(
      namesAt(
        "packages/server/src/modules/todos/commands/create-todo.handler.ts",
        makeFileSystemFake([]),
      ),
    ).toEqual(["command-handler-test"]);
  });

  it("is satisfied once the sibling exists", () => {
    expect(
      namesAt(
        "packages/server/src/modules/todos/commands/create-todo.handler.ts",
        makeFileSystemFake([
          "packages/server/src/modules/todos/commands/create-todo.handler.test.ts",
        ]),
      ),
    ).toEqual([]);
  });

  it("exempts a file its fileNot names", () => {
    // This toy config declares no interface/http folder rule, so the taxonomy
    // root still fires here; what matters is that the parity rule does not.
    expect(
      namesAt(
        "packages/server/src/modules/auth/interface/http/login.endpoint.ts",
        makeFileSystemFake([]),
      ),
    ).not.toContain("endpoint-test");
  });

  it("reports one violation per missing sibling", () => {
    expect(
      namesAt(
        "packages/server/src/modules/todos/domain/todo/todos.repository.ts",
        makeFileSystemFake([]),
      ),
    ).toEqual(["repository-port-counterparts", "repository-port-counterparts"]);
  });
});

describe("requiredSiblingsOf", () => {
  const parityRule = (name: string) => {
    const rule = compiled().parity.find((one) => one.name === name);
    if (rule === undefined) throw new Error(`no parity rule named ${name}`);
    return rule;
  };

  // `{base}` is the filename minus its FINAL extension, so the dot-delimited
  // stereotype survives into the sibling's name.
  it("keeps the stereotype in the base name", () => {
    expect(
      requiredSiblingsOf(
        parityRule("command-handler-test"),
        "packages/x/commands/create-todo.handler.ts",
      ),
    ).toEqual(["packages/x/commands/create-todo.handler.test.ts"]);
  });

  it("resolves ../ against the file's own folder", () => {
    expect(
      requiredSiblingsOf(
        parityRule("repository-port-counterparts"),
        "packages/server/src/modules/todos/domain/todo/todos.repository.ts",
      ),
    ).toEqual([
      "packages/server/src/modules/todos/infrastructure/repositories/todos.repository-live.ts",
      "packages/server/src/modules/todos/infrastructure/repositories/todos.repository-fake.ts",
    ]);
  });
});

describe("structureRulesFailingTheirProbe", () => {
  it("passes a taxonomy whose rules all reject their own probe", () => {
    expect(structureRulesFailingTheirProbe(compiled())).toEqual([]);
  });

  it("catches a folder rule whose admitted set has widened to swallow its probe", () => {
    const widened: StructureConfig = {
      ...config,
      folders: (config.folders ?? []).map((rule) =>
        rule.name === "commands-folder" ? { ...rule, files: [".*"] } : rule,
      ),
    };
    const outcome = compileStructure(widened);
    if (Result.isFailure(outcome)) throw outcome.failure;
    expect(structureRulesFailingTheirProbe(outcome.success)).toEqual(["commands-folder"]);
  });

  it("catches a parity rule that no longer selects its probe", () => {
    const drifted: StructureConfig = {
      ...config,
      parity: (config.parity ?? []).map((rule) =>
        rule.name === "endpoint-test" ? { ...rule, file: "^never-matches/" } : rule,
      ),
    };
    const outcome = compileStructure(drifted);
    if (Result.isFailure(outcome)) throw outcome.failure;
    expect(structureRulesFailingTheirProbe(outcome.success)).toEqual(["endpoint-test"]);
  });

  it("catches a root whose region every folder rule now governs", () => {
    const covered: StructureConfig = {
      ...config,
      folders: [
        ...(config.folders ?? []),
        {
          name: "catch-all",
          message: "anything goes",
          probe: { path: "packages/server/src/modules/alpha/helpers/probe.ts" },
          folder: ".*",
          files: [".*"],
        },
      ],
    };
    const outcome = compileStructure(covered);
    if (Result.isFailure(outcome)) throw outcome.failure;
    expect(structureRulesFailingTheirProbe(outcome.success)).toContain("server-module-taxonomy");
  });
});

describe("compileStructure", () => {
  const broken = "^packages/(unclosed";

  it("is empty when the policy declares no structure at all", () => {
    const compiled = compileStructure(undefined);
    expect(Result.isSuccess(compiled) && compiled.success).toEqual(EMPTY_STRUCTURE);
  });

  it("is empty when the policy declares a structure with no rules of any kind", () => {
    const compiled = compileStructure({});
    expect(Result.isSuccess(compiled) && compiled.success).toEqual(EMPTY_STRUCTURE);
  });

  // A pattern that cannot compile has to surface as a decode failure, not as a
  // rule that silently governs nothing.
  it.each([
    ["a taxonomy root's path", { roots: [{ ...config.roots?.[0], path: broken }] }],
    ["a folder rule's folder", { folders: [{ ...config.folders?.[0], folder: broken }] }],
    ["a folder rule's files", { folders: [{ ...config.folders?.[0], files: [broken] }] }],
    ["a parity rule's file", { parity: [{ ...config.parity?.[0], file: broken }] }],
    ["a parity rule's fileNot", { parity: [{ ...config.parity?.[0], fileNot: [broken] }] }],
  ])("refuses an invalid pattern in %s", (_, partial) => {
    const compiled = compileStructure(partial as StructureConfig);
    expect(Result.isFailure(compiled) && compiled.failure.pattern).toBe(broken);
  });
});

describe("path arithmetic", () => {
  it("governs a file sitting at the repository root, which has no folder", () => {
    expect(namesAt("stray.ts", makeFileSystemFake([]))).toEqual([]);
  });

  // A leading dot is not an extension: `.gitignore` is its own base, or every
  // dotfile would owe a sibling named after the empty string.
  it("treats a leading dot as part of the name rather than an extension", () => {
    expect(
      requiredSiblingsOf(
        {
          name: "x",
          message: "x",
          file: [/.*/],
          fileNot: [],
          requires: ["{base}.md"],
          probe: "x",
        },
        "docs/.gitignore",
      ),
    ).toEqual(["docs/.gitignore.md"]);
  });

  it("resolves `.` and empty segments in a required sibling", () => {
    expect(
      requiredSiblingsOf(
        {
          name: "x",
          message: "x",
          file: [/.*/],
          fileNot: [],
          requires: ["./{base}-live.ts", "..//{base}-fake.ts"],
          probe: "x",
        },
        "a/b/thing.repository.ts",
      ),
    ).toEqual(["a/b/thing.repository-live.ts", "a/thing.repository-fake.ts"]);
  });
});

describe("a required sibling of a file at the repository root", () => {
  it("resolves against the root itself rather than against an empty segment", () => {
    expect(
      requiredSiblingsOf(
        {
          name: "x",
          message: "x",
          file: [/.*/],
          fileNot: [],
          requires: ["{base}.test.ts"],
          probe: "x",
        },
        "index.ts",
      ),
    ).toEqual(["index.test.ts"]);
  });
});

describe("evaluateStructure naming", () => {
  const kebab = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

  const naming = (rule: StructureNaming | null): CompiledStructure => {
    const compiled = compileStructure({
      naming: [
        rule ?? {
          name: "concept-name",
          message: "A concept name here is kebab-case.",
          probe: { path: `${PROBE_AT}/zzProbeStray.root.ts` },
          file: [`^${PROBE_AT.replace("alpha", "[^/]+")}/([^/.]+)[^/]*$`],
          subject: 1,
          convention: kebab,
        },
      ],
    });
    if (Result.isFailure(compiled)) throw compiled.failure;
    return compiled.success;
  };

  const at = (structure: CompiledStructure, file: string) =>
    evaluateStructure(structure, ALL_PRESENT, file).map((violation) => violation.subject);

  it("admits a name the convention accepts", () => {
    expect(at(naming(null), `${PROBE_AT}/create-todo.root.ts`)).toEqual([]);
  });

  // The concept name is the basename up to the FIRST dot, so a compound
  // stereotype is not mistaken for part of it.
  it("judges the concept name, not the whole stem", () => {
    expect(at(naming(null), `${PROBE_AT}/todos.repository-live.ts`)).toEqual([]);
    expect(at(naming(null), `${PROBE_AT}/Todos.repository-live.ts`)).toEqual(["Todos"]);
  });

  it("reports a name the convention rejects, naming it", () => {
    expect(at(naming(null), `${PROBE_AT}/TodoAggregate.root.ts`)).toEqual(["TodoAggregate"]);
  });

  it("ignores a file its own fileNot exempts", () => {
    expect(
      at(
        naming({
          name: "concept-name",
          message: "A concept name here is kebab-case.",
          probe: { path: `${PROBE_AT}/zzProbeStray.id.ts` },
          file: [`^${PROBE_AT.replace("alpha", "[^/]+")}/([^/.]+)[^/]*$`],
          fileNot: ["\\.root\\.ts$"],
          subject: 1,
          convention: kebab,
        }),
        `${PROBE_AT}/TodoAggregate.root.ts`,
      ),
    ).toEqual([]);
  });

  // `sameAs` is what "named after its folder" compiles to: two capture groups
  // from one match, compared to each other.
  describe("a name that has to equal another capture", () => {
    const sameAs = naming({
      name: "named-after-its-folder",
      message: "A root is named after its folder.",
      probe: { path: "modules/alpha/domain/beta/zz.root.ts" },
      file: ["^modules/[^/]+/domain/([^/]+)/([^/.]+)\\.root\\.ts$"],
      subject: 2,
      sameAs: 1,
    });

    it("admits the file whose name is its folder's", () => {
      expect(at(sameAs, "modules/todos/domain/todo/todo.root.ts")).toEqual([]);
    });

    it("reports one named after something else", () => {
      expect(at(sameAs, "modules/todos/domain/todo/user.root.ts")).toEqual(["user"]);
    });
  });
});

describe("structureRulesFailingTheirProbe for naming", () => {
  // The guard the package exists for: a convention that admits its own probe is
  // a convention that could never report anything.
  it("fails a rule whose probe its own convention accepts", () => {
    const compiled = compileStructure({
      naming: [
        {
          name: "vacuous",
          message: "x",
          probe: { path: `${PROBE_AT}/anything.ts` },
          file: [`^${PROBE_AT.replace("alpha", "[^/]+")}/([^/.]+)[^/]*$`],
          subject: 1,
          convention: "^.*$",
        },
      ],
    });
    if (Result.isFailure(compiled)) throw compiled.failure;
    expect(structureRulesFailingTheirProbe(compiled.success)).toEqual(["vacuous"]);
  });
});

describe("compileStructure naming failures", () => {
  const broken = "^packages/(unclosed";
  const valid: StructureNaming = {
    name: "concept-name",
    message: "x",
    probe: { path: "a/zzProbeStray.ts" },
    file: ["^a/([^/.]+)[^/]*$"],
    subject: 1,
    convention: "^[a-z]+$",
  };

  it.each([
    ["file", { file: broken }],
    ["fileNot", { fileNot: [broken] }],
    ["convention", { convention: broken }],
  ])("refuses an invalid pattern in %s", (field, override) => {
    const compiled = compileStructure({ naming: [{ ...valid, ...override }] });
    expect(Result.isFailure(compiled) && compiled.failure.field).toBe(field);
  });

  // A `sameAs` pointing at a group the pattern does not have compares against
  // nothing, so the name can never satisfy it.
  it("reports a name whose sameAs group the pattern never fills", () => {
    const { convention: _unused, ...withoutConvention } = valid;
    const compiled = compileStructure({ naming: [{ ...withoutConvention, sameAs: 7 }] });
    if (Result.isFailure(compiled)) throw compiled.failure;
    expect(
      evaluateStructure(compiled.success, ALL_PRESENT, "a/thing.ts").map((one) => one.subject),
    ).toEqual(["thing"]);
  });

  it("ignores a file whose pattern matches without filling the subject", () => {
    const compiled = compileStructure({
      naming: [{ ...valid, file: ["^a/[^/]+$"], subject: 1 }],
    });
    if (Result.isFailure(compiled)) throw compiled.failure;
    expect(evaluateStructure(compiled.success, ALL_PRESENT, "a/thing.ts")).toEqual([]);
  });
});
