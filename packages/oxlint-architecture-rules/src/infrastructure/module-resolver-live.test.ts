import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import type { ResolveConfig } from "../domain/architecture-config.js";
import { makeModuleResolverLive } from "./module-resolver-live.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const config: ResolveConfig = {
  scopes: [
    {
      files: "^packages/(server|contracts|jobs|database)/",
      tsconfig: "tsconfig.resolve.json",
    },
    { files: "^packages/(web|components)/", tsconfig: "tsconfig.resolve-web.json" },
  ],
};

const resolver = makeModuleResolverLive(repoRoot, config);

const resolve = (fromFile: string, specifier: string) => {
  const outcome = resolver.resolve(fromFile, specifier);
  if (Result.isFailure(outcome)) throw outcome.failure;
  return outcome.success;
};

const SERVER_FILE = "packages/server/src/modules/todos/commands/create-todo.handler.ts";

describe("makeModuleResolverLive", () => {
  // Every one of these is a shape dependency-cruiser resolves today. A gap here
  // is not a missing feature — it is a rule that stops reporting.
  it("resolves a NodeNext relative specifier through its .js extension", () => {
    expect(resolve(SERVER_FILE, "./create-todo.command.js").path).toBe(
      "packages/server/src/modules/todos/commands/create-todo.command.ts",
    );
  });

  it("resolves the package's own @/ alias", () => {
    expect(resolve(SERVER_FILE, "@/platform/ids/user-id.js").path).toBe(
      "packages/server/src/platform/ids/user-id.ts",
    );
  });

  it("resolves a workspace package subpath to its source file", () => {
    expect(resolve(SERVER_FILE, "@org/contracts/Policy").path).toBe(
      "packages/contracts/src/Policy.ts",
    );
  });

  it("resolves an npm subpath into node_modules and marks it external", () => {
    const target = resolve(SERVER_FILE, "effect/Schema");
    expect(target.kind).toBe("external");
    expect(target.path).toMatch(/node_modules\/effect\/dist\/Schema\.js$/);
  });

  // A builtin is its own kind: dependency-cruiser calls it `core`, not `npm`,
  // and a rule fencing off npm dependencies must not catch `node:crypto`.
  it("resolves a node builtin as its own dependency kind", () => {
    expect(resolve(SERVER_FILE, "node:crypto")).toEqual({ path: "node:crypto", kind: "builtin" });
  });

  it("fails on a specifier that resolves to nothing", () => {
    expect(Result.isFailure(resolver.resolve(SERVER_FILE, "@org/does-not-exist"))).toBe(true);
  });

  it("fails on a file no resolve scope covers, rather than passing it silently", () => {
    expect(Result.isFailure(resolver.resolve("scripts/lint-parity.mjs", "node:path"))).toBe(true);
  });

  it("resolves web files through the web scope's own aliases", () => {
    expect(
      resolve("packages/web/features/todos/todos.view.tsx", "@org/components/primitives/index")
        .path,
    ).toMatch(/^packages\/components\/primitives\//);
  });
});
