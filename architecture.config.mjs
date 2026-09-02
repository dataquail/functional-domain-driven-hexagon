// The architecture policy: every boundary in this monorepo, as one manifest.
//
// It reads like a directory listing — a key ending in `/` is a folder, anything
// else is a file — and everything the architecture says about a part of the tree
// is written at that part of the tree: what it may import, who may import it,
// which names it may declare, and which siblings its files owe.
//
// Patterns are globs over repo-relative paths, matched against FULLY RESOLVED
// targets:
//
//   *          part of one path segment          {name}   captures one segment
//   **         any number of segments            [A-Z]    a character class
//   a/**       `a` itself as well as a/b/c       |        several patterns, one node
//
// The default is tight. A folder admits only the children it lists; a file may
// import only what it or an ancestor allows. Laxity is opted into by name:
// `reset` drops inherited allowances, `unrestricted` says a tier has no
// allowlist yet, `layout: "open"` says a folder does not enumerate its files.
// Prohibitions are the exception — a `deny` always accumulates, so no node can
// make a subtree quieter than its ancestors.
//
// Every rule this compiles to carries a probe it must report, generated from
// the node's own path. The plugin refuses to load if any rule fails its own —
// a rule that has drifted into matching nothing is the failure this whole
// apparatus exists to prevent. See `.claude/rules/architecture-rules.md`.

import { leafPackages } from "./packages/architecture.mjs";
import { componentsTree } from "./packages/components/architecture.mjs";
import { serverTree } from "./packages/server/architecture.mjs";
import { webTree } from "./packages/web/architecture.mjs";

/** @type {import("oxlint-architecture-rules").Manifest} */
export default {
  // Where a repository adopting this policy records the violations it is
  // carrying. This one has none, so the file is absent — and `architecture
  // baseline` would write an empty list rather than a place to hide.
  baseline: ".architecture-baseline.json",

  resolve: {
    // Web and components resolve `@/*` and `@org/components/*` to their own
    // roots; everything else resolves through the server-side mapping. The
    // catch-all must come last.
    scopes: [
      { files: "^packages/(web|components)/", tsconfig: "tsconfig.resolve-web.json" },
      { files: "^packages/acceptance/", tsconfig: "packages/acceptance/tsconfig.json" },
      { files: "", tsconfig: "tsconfig.resolve.json" },
    ],
    // An import nobody can resolve is an import no rule can police. Loud by
    // default; anything listed here needs a reason next to it.
    unresolved: "error",
    ignoreUnresolved: [],
  },

  aliases: {
    "@": "packages/server/src",
    "~": "packages",
  },

  // Prohibitions that hold for every file in the repo. Three of these used to
  // live on the module root, which meant web, components and the platform
  // kernel were quietly outside them.
  deny: [
    {
      // A list, not a `|` string: the alternation shorthand is a tree-key
      // feature, and in a pattern the pipe is a literal.
      match: ["**/*.test.ts", "**/*.test.tsx"],
      message:
        "This file depends on a spec (test) file. The sole responsibility of a spec file is to test code — if two tests need the same fixture, the fixture belongs beside them in a harness, not inside one of the tests.",
    },
    {
      match: "**/node_modules/@effect/sql-pg/**",
      except: ["~/database/src/**", "~/server/src/platform/persistence/*.test.ts"],
      message:
        "The SQL driver is an implementation detail of @org/database. Everything else speaks the `Database` client and the row-decoding helpers that package publishes; reaching for @effect/sql-pg directly puts driver types in a signature the rest of the repo has to live with.",
    },
    {
      match: "**/node_modules/effect/**/unstable/rpc/**",
      message:
        "The RPC transport stays behind @effect-server-utils/cqrs. Messages are declared with Command.make / Query.make and dispatched through the bus; reaching for effect/unstable/rpc directly bypasses the routing table, the middleware and the span the bus provides.",
    },
  ],

  // Which importers may name a given exported symbol. A path rule cannot say
  // this: every importer of a barrel resolves to the same file, so only the
  // imported name separates a bus factory from the Tag beside it.
  exports: [
    {
      name: "bus-factories-at-composition-roots",
      message:
        "Constructing a bus takes the WHOLE routing table, so anything that builds one could answer a message with a different module's handler than the composed application would. Only a composition root may (ADR-0006): server.ts, platform/cqrs/cqrs-runtime.ts, or test-utils/. Depend on the CommandBus/QueryBus Tag instead, or — inside a module — publish that module's own surface with Command.dispatcher. The event bus, the unit of work and the unhandled-failure sink are fenced for a related reason: a second instance of any of them is subscribers nobody notifies, a transaction nobody joins, or reports nobody reads.",
      // Both libraries publish every module as its own export subpath as well as
      // through the barrel, so the target admits either — a deep import is
      // otherwise a one-character way around this.
      module: "**/node_modules/@effect-server-utils/**",
      symbols: [
        "makeCommandBus",
        "makeQueryBus",
        "mergeDispatchTables",
        "makeEventBus",
        "makeUnitOfWork",
        "makeUnhandledFailures",
      ],
      except: ["@/server.ts", "@/platform/cqrs/**", "@/test-utils/**", "**/*.test.ts"],
    },
    {
      name: "no-effect-namespace-imports",
      message:
        'Import an Effect module by its own subpath as a namespace — `import * as Effect from "effect/Effect"` — not as a named import off the package barrel. The barrel pulls the whole module graph into the import, and the namespace form is what every file in this repo reads like.',
      // The barrel only. `effect/Effect` resolves to `dist/Effect.js` and is the
      // form this rule steers toward, so matching the package root is what keeps
      // the rule from firing on its own advice.
      module: [
        "**/node_modules/effect/dist/index.js",
        "**/node_modules/@effect/platform/dist/index.js",
        "**/node_modules/@effect/rpc/dist/index.js",
        "**/node_modules/@effect/sql/dist/index.js",
        "**/node_modules/@effect/platform-browser/dist/index.js",
        "**/node_modules/@effect/platform-node/dist/index.js",
      ],
      fix: "subpath-namespace-import",
    },
  ],

  // The tree, composed from one file per area. Each area's file states its own
  // nodes against repo-relative paths; the policy is still evaluated as one, so
  // an inbound rule and a repo-wide prohibition reach every file in the repo.
  tree: {
    ...leafPackages,
    ...componentsTree,
    ...webTree,
    ...serverTree,
  },
};
