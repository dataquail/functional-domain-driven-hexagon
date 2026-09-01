import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import type { StructureConfig } from "../domain/architecture-config.js";
import { makeFileSystemFake } from "../infrastructure/file-system-fake.js";
import type { FileSystem } from "../ports/file-system.js";
import {
  compileStructure,
  evaluateStructure,
  requiredSiblingsOf,
  structureRulesFailingTheirProbe,
} from "./structure.js";

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
