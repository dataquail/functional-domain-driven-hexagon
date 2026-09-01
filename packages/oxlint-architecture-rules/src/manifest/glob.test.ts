import { describe, expect, it } from "vitest";

import { anchored, globToRegexSource } from "./glob.js";

const compile = (glob: string, declaring = true) =>
  globToRegexSource(glob, {}, { declaring, nextGroup: 1 });

const matches = (glob: string, value: string): boolean =>
  new RegExp(anchored(compile(glob).source)).test(value);

describe("globToRegexSource", () => {
  it("keeps * inside one path segment", () => {
    expect(matches("*.root.ts", "todo.root.ts")).toBe(true);
    expect(matches("*.root.ts", "nested/todo.root.ts")).toBe(false);
  });

  it("lets ** cross segments", () => {
    expect(matches("a/**", "a/b/c.ts")).toBe(true);
  });

  // `a/**` naming only `a`'s descendants and not `a` itself is the kind of
  // off-by-one that makes an allowlist quietly too narrow.
  it("lets a trailing /** match the folder itself", () => {
    expect(matches("a/**", "a")).toBe(true);
  });

  it("treats a dot as a literal, so a stereotype cannot match by accident", () => {
    expect(matches("*.root.ts", "todoXrootXts")).toBe(false);
  });

  it("declares a capture group where a path key names one", () => {
    expect(compile("{module}/domain").source).toBe("([^/]+)/domain");
  });

  it("refers back to an ancestor's capture as the back-reference the IR wants", () => {
    const declared = globToRegexSource("{module}", {}, { declaring: true, nextGroup: 1 });
    const referring = globToRegexSource("modules/{module}/commands", declared.captures, {
      declaring: false,
      nextGroup: 2,
    });
    expect(referring.source).toBe("modules/$1/commands");
  });

  // A reference to a capture nobody declared would compile to a literal that can
  // never match — a rule that silently enforces nothing.
  it("refuses a reference to a capture no ancestor declares", () => {
    expect(() => globToRegexSource("{nowhere}/x", {}, { declaring: false, nextGroup: 1 })).toThrow(
      /no ancestor path declares/,
    );
  });
});
