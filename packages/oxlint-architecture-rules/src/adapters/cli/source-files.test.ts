import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { listSourceFiles, specifiersOf } from "./source-files.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("listSourceFiles", () => {
  it("finds the sources under a root", () => {
    const files = listSourceFiles(repoRoot, ["packages/oxlint-architecture-rules/src/core"]);
    expect(files).toContain("packages/oxlint-architecture-rules/src/core/baseline.ts");
  });

  // A declaration file states types, not code; no linter visits one.
  it("skips declaration files", () => {
    expect(listSourceFiles(repoRoot, ["packages/web"]).some((f) => f.endsWith(".d.ts"))).toBe(
      false,
    );
  });

  it("skips the folders no policy is written about", () => {
    expect(
      listSourceFiles(repoRoot, ["packages/oxlint-architecture-rules"]).some((f) =>
        /node_modules|\/build\//.test(f),
      ),
    ).toBe(false);
  });
});

describe("specifiersOf", () => {
  // The reason this uses TypeScript's preprocessor and not a regex: the
  // `server-only` side-effect imports in packages/web are invisible to one, and
  // they were missed for several rounds because of it.
  it("sees a side-effect import with no clause", () => {
    expect(specifiersOf(repoRoot, "packages/web/services/data-access/todos.server.ts")).toContain(
      "server-only",
    );
  });

  it("sees ordinary and aliased imports", () => {
    const found = specifiersOf(repoRoot, "packages/web/services/data-access/todos.server.ts");
    expect(found).toContain("@/services/atom/prefetch.server");
    expect(found).toContain("./todos.atoms");
  });
});
