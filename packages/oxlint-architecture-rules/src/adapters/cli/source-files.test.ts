import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { listSourceFiles } from "./source-files.js";

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
