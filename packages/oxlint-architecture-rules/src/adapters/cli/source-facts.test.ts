import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { sourceFactsOf } from "./source-facts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

// Inside the package rather than the OS temp dir, for the same reason the config
// loader's fixtures are: Vitest resolves through its own module graph.
const scratch = path.resolve(here, "../../../.tmp-facts-tests");
mkdirSync(scratch, { recursive: true });

afterAll(() => {
  rmSync(scratch, { force: true, recursive: true });
});

let counter = 0;
const factsFor = (source: string, extension = "ts") => {
  counter += 1;
  const file = `packages/oxlint-architecture-rules/.tmp-facts-tests/fixture-${String(counter)}.${extension}`;
  writeFileSync(path.join(repoRoot, file), source);
  return sourceFactsOf(repoRoot, file);
};

describe("specifiers", () => {
  // The form a regex cannot see. Eleven of these in packages/web were invisible
  // to the survey harness for several rounds, which is why the CLI parses.
  it("sees a side-effect import with no clause", () => {
    expect(factsFor(`import "server-only";`).specifiers).toEqual(["server-only"]);
  });

  it("sees every module-edge form", () => {
    const facts = factsFor(`
      import a from "m1";
      import { b } from "m2";
      import * as c from "m3";
      export { d } from "m4";
      export * from "m5";
      const e = await import("m6");
      import f = require("m7");
      const g = require("m8");
    `);
    expect([...facts.specifiers]).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
  });

  it("lists an edge once however many names cross it", () => {
    expect(factsFor(`import { a, b, c } from "m";`).specifiers).toEqual(["m"]);
  });
});

describe("bindings", () => {
  const bindings = (source: string, specifier: string) =>
    factsFor(source).bindings.get(specifier) ?? [];

  it("reads a named import by the name in the source module, not the local alias", () => {
    expect(bindings(`import { makeCommandBus as make } from "m";`, "m")).toEqual([
      { symbol: "makeCommandBus", kind: "named" },
    ]);
  });

  it("distinguishes default from namespace from named", () => {
    expect(bindings(`import d, * as n from "m";`, "m")).toEqual([
      { symbol: "default", kind: "default" },
      { symbol: "*", kind: "namespace" },
    ]);
  });

  it("reads a re-export's source name", () => {
    expect(bindings(`export { a as b } from "m";`, "m")).toEqual([{ symbol: "a", kind: "named" }]);
  });

  // A side-effect import is an edge with nothing crossing it: the import rules
  // still see the edge, the export rules have no name to judge.
  it("gives a side-effect import no bindings", () => {
    expect(bindings(`import "m";`, "m")).toEqual([]);
  });

  it("reads a string-literal import name", () => {
    expect(bindings(`import { "a-b" as ab } from "m";`, "m")).toEqual([
      { symbol: "a-b", kind: "named" },
    ]);
  });
});

describe("member sites", () => {
  it("reads the members of a type alias, and the alias they sit in", () => {
    expect(
      factsFor(`type XRepositoryShape = { readonly findOneById: () => void };`).memberSites,
    ).toEqual([
      expect.objectContaining({
        subject: "type-members",
        name: "findOneById",
        in: "XRepositoryShape",
      }),
    ]);
  });

  it("reads a method signature as well as a property one", () => {
    const names = factsFor(`type X = { a: () => void; b(): void };`).memberSites.map(
      (site) => site.name,
    );
    expect(names).toEqual(["a", "b"]);
  });

  // A computed key is not a name a vocabulary rule can speak about.
  it("skips a computed key", () => {
    expect(factsFor(`const k = "x"; type X = { [k]: string };`).memberSites).toEqual([]);
  });

  it("reads a called identifier and a called member", () => {
    const names = factsFor(`useState(0); React.useEffect(fn);`).memberSites.map(
      (site) => site.name,
    );
    expect(names).toEqual(expect.arrayContaining(["useState", "useEffect"]));
  });

  it("reads calls inside JSX", () => {
    const names = factsFor(
      `export const V = () => <div>{useState(0)}</div>;`,
      "tsx",
    ).memberSites.map((site) => site.name);
    expect(names).toContain("useState");
  });
});

describe("members the reader steps over", () => {
  it("reads a string-literal member name and the alias it sits in", () => {
    expect(factsFor(`type X = { "find-one": () => void };`).memberSites).toEqual([
      expect.objectContaining({ name: "find-one", in: "X" }),
    ]);
  });

  it("skips an index signature, which names nothing a vocabulary rule can speak about", () => {
    expect(factsFor(`type X = { [key: string]: () => void };`).memberSites).toEqual([]);
  });

  it("skips a call whose callee is neither an identifier nor a member", () => {
    expect(factsFor(`(() => 1)();`).memberSites).toEqual([]);
  });
});
