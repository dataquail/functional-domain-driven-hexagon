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

describe("single-character wildcards and back-references", () => {
  it("matches exactly one non-separator character for `?`", () => {
    expect(matches("a?.ts", "ab.ts")).toBe(true);
    expect(matches("a?.ts", "abc.ts")).toBe(false);
    expect(matches("a?.ts", "a/.ts")).toBe(false);
  });

  // A `{name}` outside the key that declared it is a back-reference, so the
  // same segment has to appear on both sides.
  it("compiles a non-declaring capture to a back-reference to the group above", () => {
    const declared = globToRegexSource("modules/{module}/", {}, { declaring: true, nextGroup: 1 });
    const referenced = globToRegexSource("modules/{module}/domain", declared.captures, {
      declaring: false,
      nextGroup: 2,
    });

    expect(declared.captures).toEqual({ module: 1 });
    expect(referenced.source).toContain("$1");
  });
});

describe("capturing wildcards", () => {
  // Off by default, and it has to stay that way: a stray group would renumber
  // the back-references `{capture}` compiles to.
  it("leaves * uncaptured unless asked", () => {
    expect(compile("*.root.ts").wildcards).toEqual([]);
    expect(compile("*.root.ts").source).toContain("[^/]*");
  });

  it("captures each * in source order when asked, alongside the named ones", () => {
    const compiled = globToRegexSource(
      "{module}/deep/*.test.ts",
      {},
      {
        declaring: true,
        nextGroup: 1,
        capturing: true,
      },
    );
    expect(compiled.captures).toEqual({ module: 1 });
    expect(compiled.wildcards).toEqual([2]);
  });
});
