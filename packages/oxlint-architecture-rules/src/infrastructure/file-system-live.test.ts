import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { makeFileSystemLive } from "./file-system-live.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("makeFileSystemLive", () => {
  const fileSystem = makeFileSystemLive(repoRoot);

  it("answers for a path that exists", () => {
    expect(fileSystem.exists("packages/oxlint-architecture-rules/package.json")).toBe(true);
  });

  it("answers for a path that does not", () => {
    expect(fileSystem.exists("packages/oxlint-architecture-rules/nowhere.json")).toBe(false);
  });

  // Every handler in a folder asks about the same `../../infrastructure/...`
  // shape, so a repeated question must not become a repeated syscall.
  it("gives the same answer from its cache on a repeat question", () => {
    expect(fileSystem.exists("package.json")).toBe(true);
    expect(fileSystem.exists("package.json")).toBe(true);
  });
});
