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

/** @type {import("@goodbones/core").Manifest} */
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
      {
        files: "^packages/(web|components)/",
        language: "typescript",
        options: { tsconfig: "tsconfig.resolve-web.json" },
      },
      {
        files: "^packages/acceptance/",
        language: "typescript",
        options: { tsconfig: "packages/acceptance/tsconfig.json" },
      },
      { files: "", language: "typescript", options: { tsconfig: "tsconfig.resolve.json" } },
    ],
    // An import nobody can resolve is an import no rule can police. Loud by
    // default; anything listed here needs a reason next to it.
    unresolved: "error",
    ignoreUnresolved: [],
  },

  // Ratchets on the policy itself. The ceilings are how many tiers may say
  // "not tightened yet"; the floors are how much of the tree each family must
  // reach, as `architecture coverage packages` reported it on the day the
  // floor was written, rounded down. Raise a floor when coverage rises; never
  // lower one to make a red run green — the fix is a rule that reaches the
  // files, or a file moved under one. Structure counts enumerated folders
  // only: an open folder is claimed, not policed by name.
  limits: {
    unrestricted: 1,
    partial: 0,
    coverage: { imports: 0.96, structure: 0.73, members: 0.03, surface: 0.91, graph: 1 },
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
      // Named bindings only, deliberately: neither library publishes a default
      // export, so `import makeCommandBus from` is a type error before it is a
      // policy question. The namespace form is the real way around a symbols
      // list, and the next restriction closes it.
      probe: {
        source: 'import { makeCommandBus } from "@effect-server-utils/cqrs";',
        symbol: "makeCommandBus",
      },
    },
    {
      name: "no-whole-server-utils-imports",
      message:
        "Taking an @effect-server-utils package whole — `import * as`, `export *`, `import()` or `require()` — binds every name it publishes at once, including the bus, unit-of-work and unhandled-failure factories the previous restriction fences to composition roots; a namespace binding would carry them past it unnamed. Import the names you use.",
      module: "**/node_modules/@effect-server-utils/**",
      kinds: ["namespace"],
      // The DDD contracts tier re-exports one domain-safe library module
      // wholesale, on purpose and with its reasons written in the file; its
      // own allowlist keeps it from naming the module that holds a factory.
      except: [
        "@/server.ts",
        "@/platform/cqrs/**",
        "@/test-utils/**",
        "**/*.test.ts",
        "@/platform/ddd/contracts/domain-event.ts",
      ],
      probe: { source: 'import * as Cqrs from "@effect-server-utils/cqrs";', symbol: "*" },
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
      probe: { source: 'import { Effect } from "effect";', symbol: "Effect" },
    },
  ],

  // Rules about the shape of the whole import graph — cycles, files nothing
  // imports, and what a tier can reach transitively. A per-edge allowlist cannot
  // say these: they need every file resolved at once, so `architecture check`
  // evaluates them and the plugin, which sees one file at a time, only compiles
  // and probes them. A vacuous graph rule still fails `pnpm lint`; a violated
  // one fails `pnpm lint:architecture`.
  graph: {
    cycles: [
      {
        name: "no-cycles",
        message:
          "These files import each other, so none of them can be understood, tested or loaded without the rest. Break the cycle by moving the shared piece below both, or by inverting one edge through a port.",
        within: "~/**",
      },
    ],
    orphans: [
      {
        name: "no-orphans",
        message:
          "Nothing imports this file and it is not an entry point, so it is code the type checker, the linter and the reader still pay for. Delete it — or, if something outside the walked tree loads it by design, list it under `entry` beside this rule.",
        within: "~/**",
        // A fake is owed to its port by the taxonomy, not to a consumer:
        // whether a test takes it is that test's business, so an unused one is
        // not an orphan. Everything else nothing imports is dead.
        withinNot: "**/*-fake.ts",
        // Imported by nothing, on purpose: what a process, a framework, a test
        // runner or a package manifest loads directly rather than through an
        // import. Each entry is a claim that something outside the graph reaches
        // the file; a path listed here to silence a finding is a lie the
        // policy then repeats.
        entry: [
          // Test runners load these by glob.
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/*.spec.ts",
          "**/*.setup.ts",
          "**/*.stories.tsx",
          "**/vitest.config.ts",
          "**/global-setup.ts",
          "~/web/test/setup.ts",
          "~/acceptance/playwright.config.ts",
          // Process entrypoints and package bins.
          "@/server.ts",
          "~/cli/src/main.ts",
          "~/jobs/src/main.ts",
          "~/mcp/src/main.ts",
          "~/database/src/scripts/**",
          // Framework-loaded by convention.
          "~/web/app/**",
          "~/web/instrumentation.ts",
          "~/web/next.config.ts",
          "~/components/.storybook/**",
        ],
      },
    ],
    reach: [
      {
        name: "domain-reaches-no-adapter",
        message:
          "A module's domain transitively reaches an adapter. The domain may only ever see effect, the DDD contracts tier and platform/ids; a path from it to infrastructure/, interface/ or a platform Live means one of the tiers it names has widened past what the domain is allowed to know about.",
        from: "@/modules/*/domain/**",
        fromNot: "**/*.test.ts",
        to: [
          "@/modules/*/infrastructure/**",
          "@/modules/*/interface/**",
          "@/platform/*-live.ts",
          "@/platform/**/*-live.ts",
        ],
      },
      {
        name: "use-cases-reach-no-adapter",
        message:
          "A use case transitively reaches an adapter. Commands, queries, event handlers and sagas depend on ports and messages; an adapter is wired against them at a composition root, never beneath them. Whichever file on the route named the adapter has stepped outside its tier.",
        from: [
          "@/modules/*/commands/**",
          "@/modules/*/queries/**",
          "@/modules/*/event-handlers/**",
          "@/modules/*/sagas/**",
        ],
        fromNot: "**/*.test.ts",
        to: ["@/modules/*/infrastructure/**", "@/modules/*/interface/**"],
      },
      {
        // The `via` shape: a path is fine as long as it steps onto the
        // mediating tier. platform/cqrs/ and platform/middlewares/ name a
        // module's barrel, and the barrel may reach whatever it publishes;
        // only a route that avoids every barrel is the violation.
        name: "platform-reaches-modules-only-through-barrels",
        message:
          "The platform kernel reaches inside a module without passing through its barrel. platform/cqrs/ and platform/middlewares/ may name a module's index.ts; anything a route from platform/ touches without going through one is a module internal the module is free to change without telling the kernel.",
        from: "@/platform/**",
        fromNot: "**/*.test.ts",
        to: "@/modules/*/**",
        via: "@/modules/*/index.ts",
      },
      {
        name: "web-never-reaches-the-server",
        message:
          "packages/web transitively reaches packages/server. The browser talks to the BFF over HTTP through the contracts package and nothing else; a route from web to the server means a package both depend on has grown a server dependency.",
        from: "~/web/**",
        to: "~/server/**",
      },
      {
        name: "contracts-reach-nothing",
        message:
          "@org/contracts transitively reaches the server, web or the database. It is the root of the dependency graph — every package depends on it — so anything it reaches becomes a dependency of the whole repo.",
        from: "~/contracts/**",
        to: ["~/server/**", "~/web/**", "~/database/**"],
      },
    ],
  },

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
