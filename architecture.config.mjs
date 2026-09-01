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

// Shared nodes. The manifest is a JavaScript module, so a stereotype that means
// the same thing in two folders is one `const` rather than a config feature.

// A test may reach for its harness, so it carries no allowlist. It still inherits
// every prohibition — a prohibition is not something a node can opt out of.
const testFile = {
  imports: {
    reset: true,
    message:
      "A test may reach anything inside the server it is testing, plus its harness, the contracts it asserts against and the database it seeds — and nothing else. It is still bound by the module-wide prohibitions: a test reaches another module through that module's barrel, and never imports another test.",
    external: [
      "effect",
      "@effect/vitest",
      "vitest",
      "@effect-server-utils/cqrs",
      "@effect-server-utils/unit-of-work",
      "stripe",
      // The one file allowed to name the SQL driver outside @org/database:
      // criteria-to-sql's test asserts the SQL it emits.
      "@effect/sql-pg",
    ],
    allow: ["node:**", "@/**", "~/contracts/**", "~/database/**"],
  },
};

// The constituent operations bags: domain-private invariant logic on an
// aggregate's internals, each owing a sibling test.
// The web tier's test node. A web test reaches its harness, the component
// library and the contracts — not the server.
const webTestFile = {
  imports: {
    reset: true,
    message:
      "A web test may reach the tier it exercises, the harnesses under test/, the component library and the contracts it asserts against. It never reaches the server.",
    external: [
      "effect",
      "@effect/atom-react",
      "react",
      "react-dom",
      "vitest",
      "@testing-library/react",
      "@testing-library/jest-dom",
      "@testing-library/user-event",
      "msw",
    ],
    allow: ["node:**", "~/web/**", "~/components/**", "~/contracts/**", "~/test-drivers/**"],
  },
};

// A Storybook story: the component's living spec and visual test (ADR-0015). It
// names the component it documents and the Storybook runtime.
const storyFile = {
  imports: {
    reset: true,
    message:
      "A story names the component it documents, the component library around it and the Storybook runtime. Nothing from web, nothing from the server.",
    external: [
      "effect",
      "react",
      "react-dom",
      "storybook",
      "@storybook/react-vite",
      "@storybook/addon-themes",
      "sonner",
      "lucide-react",
    ],
    allow: ["node:**", "~/components/**"],
  },
};

// The two MVVM tiers. Hoisted because a feature folder nests — the real shape
// is features/<area>/<feature>/ — and the rules hold at every depth.
const viewFile = {
  members: [
    {
      message:
        '`{name}` puts state or behaviour in the View, where it can only be tested through a renderer. A View\'s whole contract is "given these atom values, render this; on this interaction, write that" — move it to the sibling *.view-model.ts as an atom and read it here with useAtomValue/useAtomSet (ADR-0026).',
      subject: "calls",
      // Anything in `use*` position. The allowlist is the atom-React bindings
      // plus the two hooks that carry no state of their own: an SSR-safe unique
      // id, and a memo over a handler that already delegates.
      match: "use[A-Z]*",
      allow: [
        "useAtom",
        "useAtomValue",
        "useAtomSet",
        "useAtomSuspense",
        "useAtomRefresh",
        "useAtomSubscribe",
        "useAtomMount",
        "useAtomInitialValues",
        "useId",
        "useCallback",
      ],
    },
  ],
  imports: {
    reset: true,
    message:
      "A View depends on its ViewModel, and on nothing else (ADR-0026). It may not reach past it into services/ — not the API atoms, not the notification or navigation seams, not the runtime. Everything it renders or dispatches arrives as an atom its own ViewModel exposes; that is what lets the ViewModel be tested with no renderer and the View with no server.",
    external: ["effect", "@effect/atom-react", "react"],
    allow: ["~/web/features/{feature}/**", "~/components/**", "~/contracts/**"],
    deny: [
      {
        // Reaching for these means the logic belongs in the
        // ViewModel. Schema, Option, Result and friends are fine.
        match: [
          "**/effect/**/Effect.js",
          "**/effect/**/Stream.js",
          "**/effect/**/Fiber.js",
          "**/effect/**/Ref.js",
          "**/effect/**/SubscriptionRef.js",
          "**/effect/**/Layer.js",
          "**/effect/**/Scope.js",
          "**/effect/**/Runtime.js",
          "**/effect/**/ManagedRuntime.js",
          "**/effect/**/Cause.js",
          "**/effect/**/Exit.js",
          "**/effect/**/Match.js",
        ],
        message:
          "A View may not import Effect runtime primitives (ADR-0026). Reaching for Effect/Stream/Fiber/Ref/Layer/Scope/Runtime/Cause/Exit/Match means the logic belongs in the sibling *.view-model.ts. A View may still use Schema, Option, Result, Predicate, Duration, Array and the reactivity types it renders.",
      },
    ],
  },
};

const viewModelFile = {
  message:
    "Every *.view-model.ts needs a sibling *.view-model.test.ts (ADR-0026 — the ViewModel holds all of a feature's behaviour and runs under a bare AtomRegistry, so it is the tier that must be unit-tested).",
  requires: ["{base}.test.ts"],
  imports: {
    reset: true,
    message:
      "A ViewModel is framework-agnostic: it runs under a bare AtomRegistry in a test with no renderer anywhere (ADR-0026). It may not import react, react-dom, the atom React bindings, or a View — the arrow points View → ViewModel → Model and never back. A ViewModel that needs a hook is a View that has been misfiled.",
    external: ["effect"],
    allow: ["~/web/services/**", "~/web/features/{feature}/*.view-model.ts", "~/contracts/**"],
  },
};

const constituentOps = {
  message:
    "A constituent operations bag (*.entity-ops.ts / *.aggregate-ops.ts / *.value-object-ops.ts) is domain-private invariant logic; add the sibling *.<stereotype>.test.ts.",
  requires: ["{base}.test.ts"],
  importedBy: {
    message:
      "ADR-0003: *.entity-ops.ts / *.aggregate-ops.ts / *.value-object-ops.ts encode invariants on an aggregate's internals. They are domain-private — only the module's own domain/ may compose them, and nothing outside domain/ may touch them. Mutate the aggregate only through its root: a command, query, adapter or infrastructure file reaching for a constituent op is bypassing the root.",
    allow: ["@/modules/*/domain/**", "**/*.test.ts"],
  },
};

const specification = {
  message:
    "A specification (*.specification.ts) is a named domain predicate over an aggregate; add the sibling *.specification.test.ts.",
  requires: ["{base}.test.ts"],
};

// A port is consumed by its module's own use cases and by the adapter that
// implements it. Spelled once; the two tiers differ only in who else may ask.
const portConsumers = [
  "@/modules/*/domain/**",
  "@/modules/*/commands/**",
  "@/modules/*/queries/**",
  "@/modules/*/event-handlers/**",
  "@/modules/*/sagas/**",
  "@/modules/*/infrastructure/**",
  "@/modules/*/*.shared-deps.ts",
  "@/modules/*/*.module.ts",
  "@/modules/*/*.command-handlers.ts",
  "@/modules/*/*.query-handlers.ts",
  "@/test-utils/**",
  "**/*.test.ts",
];

// An ACL port has one consumer the other tiers do not: a policy. A check takes
// its data source as an argument and the module's contribution closes over this
// port, so `policies/` names it directly (ADR-0021, ADR-0022).
const aclPortConsumers = [...portConsumers, "@/modules/*/policies/**"];

/** @type {import("@org/oxlint-architecture-rules").Manifest} */
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

  tree: {
    // ── the leaf packages ─────────────────────────────────────────────────
    // Small trees, snapshotted from what each actually imports. The value here
    // is less the layout than the dependency direction: contracts depends on
    // nobody, api-client on contracts, cli and mcp on api-client, jobs on the
    // database kernel — and none of them on the server.

    "~/contracts/": {
      message:
        "@org/contracts holds the shared HTTP API contracts, schemas and errors, consumed by the server and every client. It is the root of the dependency graph.",
      layout: "open",
      imports: {
        message:
          "@org/contracts depends on nobody. Not the server, not the database, not a client — everything else depends on it, so anything it names becomes a dependency of the whole repo.",
        external: ["effect", "vitest", "@effect/vitest"],
        allow: ["node:**", "~/contracts/**", "vitest.shared.ts"],
      },
      children: {
        // Every module in src/ is an Effect-style module named for what it
        // exports, so its concept name is that exported name rather than a
        // kebab-case slug. The package's own config files are not.
        "src/": {
          name: "PascalCase",
          layout: "open",
          children: { "**/": { layout: "open", children: {} } },
        },
        "**/": { layout: "open", children: {} },
      },
    },

    "~/database/": {
      message:
        "@org/database is the DB access kernel: the effect/sql client, the shared RowSchemas, row decoding, and the migrations.",
      layout: "open",
      imports: {
        message:
          "@org/database is the one package that may name the SQL driver — encapsulating it is the package's job. It depends on nothing else in the repo: it publishes a client, it does not consume one.",
        external: [
          "effect",
          "@effect/sql-pg",
          "@effect/platform-node",
          "@effect/vitest",
          "pg",
          "dotenv",
          "vitest",
        ],
        allow: ["node:**", "~/database/**", "vitest.shared.ts"],
      },
      children: {
        "src/": {
          // Database.ts is an Effect-style module named for the service it
          // exports; the helpers beside it are ordinary kebab-case files.
          name: {
            regex: "^(?:Database|[a-z0-9]+(?:-[a-z0-9]+)*)$",
            message:
              "A file in @org/database is kebab-case, except Database.ts, which is named for the service it exports.",
          },
          layout: "open",
          children: {
            // A migration's name is its ordinal and what it does, in the order
            // the migrator runs them.
            "migrations/": { name: "snake_case", layout: "open", children: {} },
            "**/": { name: "kebab-case", layout: "open", children: {} },
          },
        },
        "**/": { layout: "open", children: {} },
      },
    },

    "~/api-client/": {
      name: "kebab-case",
      message:
        "@org/api-client is the shared typed client and credential store the CLI and the MCP server sit on.",
      layout: "open",
      imports: {
        message:
          "The API client speaks the contracts and nothing else. It must not reach the server it calls — the contract is the whole interface.",
        external: ["effect"],
        allow: ["node:**", "~/api-client/**", "~/contracts/**"],
      },
      children: { "**/": { layout: "open", children: {} } },
    },

    "~/cli/": {
      name: "kebab-case",
      message: "@org/cli is the command-line client: device-flow auth, organizations, todos.",
      layout: "open",
      imports: {
        message:
          "The CLI talks to the server the same way any other client does: through @org/api-client and the contracts. It never imports the server.",
        external: ["effect", "@effect/platform-node"],
        allow: ["node:**", "~/cli/**", "~/api-client/**", "~/contracts/**"],
      },
      children: { "**/": { layout: "open", children: {} } },
    },

    "~/mcp/": {
      name: "kebab-case",
      message: "@org/mcp exposes the CLI surface as MCP tools over stdio.",
      layout: "open",
      imports: {
        message:
          "The MCP server wraps the same client the CLI uses. It names the MCP SDK, @org/api-client and the contracts — never the server, and never the CLI's own command implementations.",
        external: ["effect", "@effect/platform-node", "@modelcontextprotocol/sdk", "zod"],
        allow: ["node:**", "~/mcp/**", "~/api-client/**", "~/contracts/**"],
      },
      children: { "**/": { layout: "open", children: {} } },
    },

    "~/jobs/": {
      name: "kebab-case",
      message: "@org/jobs runs the background and cron jobs.",
      layout: "open",
      imports: {
        message:
          "A job reaches the database kernel directly and nothing else in the repo. It does not import the server: a job that needs a use case should dispatch it, not compose the HTTP application.",
        external: ["effect", "@effect/platform-node", "@effect/vitest", "dotenv", "vitest"],
        allow: ["node:**", "~/jobs/**", "~/database/**", "vitest.shared.ts"],
      },
      children: { "**/": { layout: "open", children: {} } },
    },

    // ── packages/components ───────────────────────────────────────────────
    // The bespoke component library. Direction: features → patterns →
    // primitives → third-party (ADR-0015). Only primitives touch a UI library.
    "~/components/": {
      name: "kebab-case",
      message:
        "@org/components holds two trees: primitives/ (atoms) and patterns/ (molecules and organisms), plus the class-name helpers in lib/, the providers/ and the Storybook config. A new folder here is a new tier — declare it deliberately.",
      imports: {
        message:
          "@org/components is a leaf workspace package: components are consumed by web, never the reverse. It may not import @org/web or anything under packages/web/.",
        external: ["effect", "react", "react-dom", "next", "clsx", "tailwind-merge"],
        allow: ["node:**", "~/components/**"],
      },
      children: {
        // The only tier allowed to name a third-party visual library, so the
        // prop surface of those libraries stops here.
        "primitives/": {
          layout: "open",
          message:
            "primitives/ wraps the third-party visual libraries so their prop surface is encapsulated. Every primitive is explicit props and closed unions mapped through literal class tables — no className, no DOM spread.",
          imports: {
            external: [
              "@radix-ui/react-checkbox",
              "@radix-ui/react-dialog",
              "@radix-ui/react-label",
              "@radix-ui/react-select",
              "lucide-react",
              "recharts",
              "sonner",
            ],
          },
          children: {
            "*.tsx": {
              message:
                "Every primitive/pattern component needs a sibling *.stories.tsx — the story is the component's living spec and visual test (ADR-0015).",
              requires: ["{base}.stories.tsx"],
              requiresNot: ["index.tsx", "*.stories.tsx", "*.test.tsx"],
            },
            "*.stories.tsx": storyFile,
            "*.ts": {},
            "*.test.ts | *.test.tsx": webTestFile,
            "**/": {
              layout: "open",
              children: {
                "*.tsx": {
                  requires: ["{base}.stories.tsx"],
                  requiresNot: ["index.tsx", "*.stories.tsx", "*.test.tsx"],
                },
                "*.stories.tsx": storyFile,
                "*.ts": {},
                "*.test.ts | *.test.tsx": webTestFile,
              },
            },
          },
        },

        "patterns/": {
          layout: "open",
          message:
            "patterns/ composes primitives into molecules and organisms. It consumes the third-party libraries only through primitives/, and it never reaches into a feature.",
          imports: {
            reset: true,
            external: ["effect", "react"],
            allow: [
              "node:**",
              "~/components/primitives/**",
              "~/components/patterns/**",
              "~/components/lib/**",
            ],
          },
          children: {
            "*.tsx": {
              message:
                "Every primitive/pattern component needs a sibling *.stories.tsx — the story is the component's living spec and visual test (ADR-0015).",
              requires: ["{base}.stories.tsx"],
              requiresNot: ["index.tsx", "*.stories.tsx", "*.test.tsx"],
            },
            "*.stories.tsx": storyFile,
            "*.ts": {},
            "*.test.ts | *.test.tsx": webTestFile,
          },
        },

        "providers/": { layout: "open", children: { "*.tsx": {}, "*.ts": {} } },
        "lib/": { layout: "open", children: { "**/": { layout: "open", children: {} } } },
        ".storybook/": {
          layout: "open",
          imports: {
            reset: true,
            message:
              "The Storybook configuration names Storybook and the component tree it renders. Nothing else.",
            external: ["storybook", "@storybook/react-vite", "@storybook/addon-themes", "react"],
            allow: ["node:**", "~/components/**"],
          },
          children: {},
        },
      },
    },

    // ── packages/web ──────────────────────────────────────────────────────
    // Next renderer over the Effect BFF. MVVM, and the arrow points one way:
    // Model (services/) ← ViewModel (*.view-model.ts) ← View (*.view.tsx).
    "~/web/": {
      name: "kebab-case",
      message:
        "packages/web is the Next App Router renderer: app/ holds the routes, features/ the MVVM tiers, services/ the Model, lib/ and test/ the supporting code. There is no fifth folder — a new one is a new tier.",
      imports: {
        message:
          "packages/web consumes the component library and the shared contracts. It reaches a third-party visual library only through @org/components (ADR-0015), and there is no TanStack: state is Effect Atom (ADR-0026).",
        external: [
          "effect",
          "@effect/atom-react",
          "react",
          "react-dom",
          "next",
          "@vercel/otel",
          "server-only",
        ],
        allow: ["node:**", "~/web/**", "~/components/**", "~/contracts/**"],
      },
      children: {
        // Build configuration. Declared rather than left to fall through to the
        // taxonomy root, and narrow: a config file names the tool it configures.
        "instrumentation.ts | next.config.ts | vitest.config.ts | next-env.d.ts": {
          imports: {
            reset: true,
            message:
              "A build-configuration file names the tool it configures and nothing else — no features, no services, no components.",
            external: ["next", "vitest", "@vercel/otel"],
            allow: ["node:**"],
          },
        },

        // Framework surface: routes compose the Model directly (prefetch and the
        // hydration boundary), which is why the View restrictions stop here.
        "app/": {
          layout: "open",
          message:
            "app/ holds the Next file-based routes. It is framework surface: it composes the Model directly and keeps its intrinsics, so the View restrictions do not apply here.",
          children: { "**/": { layout: "open", children: {} } },
        },

        "features/": {
          message:
            "Files in packages/web/features/** must carry a view-tier stereotype (ADR-0026): a naked component is *.view.tsx, all behaviour is *.view-model.ts, and tests are *.test.{ts,tsx}. A bare component file has no stereotype — rename it *.view.tsx. There is no presenter tier.",
          children: {
            "{feature}/": {
              // __root holds the chrome every route shares — a slot in the
              // layout rather than a feature, and the one folder here that is
              // not named after one.
              name: {
                regex: "^(?:__root|[a-z0-9]+(?:-[a-z0-9]+)*)$",
                message:
                  "A feature folder is kebab-case, named after the feature. The one exception is __root, the chrome every route shares.",
              },
              message:
                "Files in packages/web/features/** must carry a view-tier stereotype (ADR-0026): *.view.tsx, *.view-model.ts, or *.test.{ts,tsx}. There is no presenter tier.",
              children: {
                "*.view.tsx": viewFile,
                "*.view-model.ts": viewModelFile,
                "*.test.ts | *.test.tsx": webTestFile,
                "**/": {
                  children: {
                    "*.view.tsx": viewFile,
                    "*.view-model.ts": viewModelFile,
                    "*.test.ts | *.test.tsx": webTestFile,
                  },
                },
              },
            },
          },
        },

        "services/": {
          layout: "open",
          message:
            "services/ is the Model: the API atoms, the transport, the reactivity keys, the bridges and the formatters. It is the innermost tier and knows nothing about the features that read it.",
          imports: {
            reset: true,
            message:
              "The Model is the innermost tier (ADR-0026). A services/ file importing from features/ inverts the arrow and couples the API surface to a screen.",
            external: ["effect", "@effect/atom-react", "react", "react-dom", "next", "server-only"],
            allow: ["node:**", "~/web/services/**", "~/components/**", "~/contracts/**"],
          },
          children: {
            "*.test.ts | *.test.tsx": webTestFile,
            "**/": {
              layout: "open",
              children: { "*.test.ts | *.test.tsx": webTestFile },
            },
          },
        },

        "lib/": { layout: "open", children: {} },

        "test/": {
          layout: "open",
          message:
            "test/ holds the harnesses: the atom registry, the integration harness, MSW handlers and fixtures.",
          imports: {
            reset: true,
            message:
              "A web harness reaches the tier it stages, the component library and the contracts it serves. It never reaches the server.",
            external: [
              "effect",
              "@effect/atom-react",
              "react",
              "react-dom",
              "msw",
              "vitest",
              "@testing-library/react",
              "@testing-library/jest-dom",
              "@testing-library/user-event",
            ],
            allow: [
              "node:**",
              "~/web/**",
              "~/components/**",
              "~/contracts/**",
              "~/test-drivers/**",
            ],
          },
          children: { "**/": { layout: "open", children: {} } },
        },
      },
    },

    // ── the process entrypoint ────────────────────────────────────────────
    "@/server.ts": {
      imports: {
        // A composition root names everything by design; an allowlist here could
        // only be "the whole repo", which is a rule that can never fire.
        unrestricted: true,
      },
      importedBy: {
        message:
          "server.ts is the process entrypoint: it composes and runs the server as a side effect of being loaded, so importing it either duplicates the composition or drags the whole dependency graph into a cycle. Nothing imports it. A test that needs the composed application builds one from test-utils/test-server.ts, which shares the same runtime slice through platform/cqrs/.",
        allow: [],
      },
    },

    // ── common/ ───────────────────────────────────────────────────────────
    // Leaf utilities every tier may reach: the typed environment and the token
    // cipher. Being reachable from everywhere is exactly why this has to stay
    // the narrowest thing in the repo.
    "@/common/": {
      name: "kebab-case",
      message:
        "common/ holds leaf utilities with no architectural position: the typed environment and the token cipher. A file here is reachable from every tier, so it may depend on nothing but effect and the node builtins. Anything that needs more than that is not common — it belongs to a tier that can name its dependencies.",
      imports: {
        message:
          "A common/ file may name effect, the node builtins and its own siblings. Nothing else — not the contracts package, not the database, not a module, not the platform. That is the whole reason it is safe to reach from anywhere.",
        external: ["effect"],
        allow: ["node:**", "@/common/**"],
      },
      children: {
        "env-vars.ts": {},
        "token-cipher.ts": {},
        "*.test.ts": testFile,
      },
    },

    // ── platform/ ─────────────────────────────────────────────────────────
    // The cross-cutting kernel every module sits on. Snapshotted from what it
    // actually imports today: each tier states its own dependencies, so the
    // `@/platform/**` the modules were granted wholesale is now a set of tiers
    // that each say what they are.
    "@/platform/": {
      name: "kebab-case",
      message:
        "platform/ holds the cross-cutting kernel: branded IDs, the DDD contracts tier, the auth and notification ports, the persistence helpers, and the Lives that bind them. A file here is shared by every module, so it earns its place by being needed by more than one.",
      imports: {
        message:
          "A top-level platform file is infrastructure for the whole server: it may name the environment, its own siblings, the contracts package and the database kernel. It must not reach into a module.",
        external: ["effect", "@effect-server-utils/cqrs", "@effect-server-utils/unit-of-work"],
        allow: ["node:**", "@/common/**", "@/platform/**", "~/contracts/**", "~/database/**"],
      },
      children: {
        // Framework glue: the HttpApi that the contracts describe and the
        // endpoints implement. It names the contracts and nothing else.
        "api.ts": {
          imports: {
            reset: true,
            message:
              "platform/api.ts assembles the HttpApi from the contracts package. It names the contracts and effect — never a module, never the database.",
            external: ["effect"],
            allow: ["~/contracts/**"],
          },
        },
        "database-live.ts": {},
        "http-endpoint.ts": {},
        "request-context.ts": {},
        "transaction-driver-live.ts": {},
        "translate-database-errors.ts": {},
        "*.test.ts": testFile,

        // The one tier the domain may name, so the one that must stay smallest.
        "ids/": {
          message:
            "platform/ids/ is the minimal shared kernel for cross-module branded entity IDs (ADR-0002).",
          imports: {
            reset: true,
            message:
              "platform/ids/ may only depend on `effect`. Drizzle column types, validation libraries, contract schemas and the like do not belong here — they leak module-internal shape into the one thing every module's domain is allowed to name.",
            external: ["effect"],
            allow: ["node:**"],
          },
          // Dash, not dot: platform's shared IDs are `user-id.ts`, where a
          // module's own are `todo.id.ts`. Two conventions, snapshotted as they
          // are rather than harmonised in passing.
          children: { "*-id.ts": {} },
        },

        "ddd/": {
          message:
            "platform/ddd/ re-imbues DDD vocabulary on the CQRS and unit-of-work libraries. contracts/ is the domain-safe tier; event-bus.ts sits deliberately outside it.",
          children: {
            "contracts/": {
              message:
                "platform/ddd/contracts/ is the only part of the kernel a module's domain/ may import (ADR-0006). It re-exports the domain-safe modules of the CQRS and unit-of-work libraries under this application's vocabulary — and the buses are deliberately NOT among them, which is what keeps a bus out of a domain port's requirement channel.",
              imports: {
                reset: true,
                message:
                  "The contracts tier names the two libraries it re-exports and its own siblings. Anything else here would become reachable from every module's domain.",
                external: ["@effect-server-utils/cqrs", "@effect-server-utils/unit-of-work"],
                allow: ["@/platform/ddd/contracts/**"],
              },
              children: {
                "domain-event.ts": {},
                "persistence-unavailable.ts": {},
                "specification.ts": {},
                "*.test.ts": testFile,
              },
            },
            // One level outside contracts/, and that placement is the rule: it is
            // what keeps the bus out of reach of the domain.
            "event-bus.ts": {
              imports: {
                reset: true,
                message: "The DDD event-bus alias names the CQRS library and nothing else.",
                external: ["@effect-server-utils/cqrs"],
              },
            },
          },
        },

        // A composition root, and the one place in platform/ that names every
        // module — through their barrels, in dependency order.
        "cqrs/": {
          message:
            "platform/cqrs/ builds the slice of the runtime that production and the test harness share verbatim: the command and query buses, the event bus, the unit of work and the unhandled-failure sink. It is a composition root, which is why the bus factories are reachable here and nowhere else.",
          imports: {
            reset: true,
            message:
              "The CQRS runtime folds every module's dispatch surface into one routing table, so it names each module through its barrel and the transaction driver that backs the unit of work. It reaches no module internals and no database client of its own.",
            external: ["effect", "@effect-server-utils/cqrs", "@effect-server-utils/unit-of-work"],
            allow: [
              "@/modules/*/index.ts",
              "@/platform/transaction-driver-live.ts",
              "@/platform/ddd/**",
            ],
          },
          children: { "cqrs-runtime.ts": {}, "*.test.ts": testFile },
        },

        "auth/": {
          message:
            "platform/auth/ is the only server-side authorization configuration: the action vocabulary, the four host types the authz library does not own, and the session cookie codec.",
          imports: {
            reset: true,
            message:
              "The auth kernel names the authz library it configures, the contracts that define the caller, its own siblings and the environment. It must not reach into a module.",
            external: ["effect", "@effect-server-utils/authz", "@effect-server-utils/unit-of-work"],
            allow: ["node:**", "@/platform/auth/**", "@/common/**", "~/contracts/**"],
          },
          children: {
            "actions.ts": {},
            "authz.ts": {},
            "cookie-codec.ts": {},
            "*.test.ts": testFile,
          },
        },

        "notifications/": {
          message:
            "platform/notifications/ holds the Mailer port, its errors, and the transports that satisfy it. The transport SDKs are enumerated here because this is the tier whose job is to have them.",
          imports: {
            reset: true,
            message:
              "A notification transport names its port, its sibling transports, the environment and its own SDK. Adding a transport means adding its SDK to this list, in the open.",
            external: ["effect", "@aws-sdk/client-sesv2", "nodemailer"],
            allow: ["@/platform/notifications/**", "@/common/**"],
          },
          children: {
            "mailer.ts": {},
            "mail-errors.ts": {},
            "*-live.ts": {},
            "*.test.ts": testFile,
          },
        },

        "middlewares/": {
          message:
            "platform/middlewares/ holds the HTTP middlewares wired at the composition root — the one part of the kernel that legitimately names a module, and only through its barrel.",
          imports: {
            reset: true,
            message:
              "A middleware resolves the caller before any endpoint runs, so it names the auth module through its barrel — never past it — plus the cookie codec, the contracts that define the caller, and the environment.",
            external: ["effect", "@effect-server-utils/cqrs", "cookie"],
            allow: [
              "node:**",
              "@/common/**",
              "@/platform/auth/**",
              "@/modules/*/index.ts",
              "~/contracts/**",
            ],
          },
          children: { "*-live.ts": {}, "*.test.ts": testFile },
        },

        "persistence/": {
          message:
            "platform/persistence/ turns the specification kit into SQL. It is the seam between a domain predicate and a query, so it names the contracts tier and nothing from a module.",
          imports: {
            reset: true,
            message:
              "The persistence helpers name the specification kit they compile and effect. No modules, no database client — the caller supplies that.",
            external: ["effect"],
            allow: ["@/platform/ddd/contracts/**", "@/platform/persistence/**"],
          },
          children: { "criteria-to-sql.ts": {}, "*.test.ts": testFile },
        },
      },
    },

    "@/modules/{module}/": {
      name: "kebab-case",
      message:
        "The module root admits only aggregation files: index.ts (barrel), <feature>.module.ts (composed Layer), <feature>.command-handlers.ts / .query-handlers.ts (bus-registration maps), <feature>.event-span-attributes.ts, <feature>.shared-deps.ts. Feature code belongs in a stereotype subfolder (domain/, commands/, queries/, event-handlers/, infrastructure/, interface/, policies/).",

      importedBy: {
        message:
          "Files outside src/modules/ must import a module through its index.ts barrel. A module is private except for the surface it publishes on purpose — reaching past the barrel couples you to a shape the module is free to change without telling you.",
        allow: ["@/modules/**", "**/*.test.ts"],
        // The barrel itself is the public surface, so the restriction does not
        // cover it.
        matchNot: ["index.ts"],
      },

      imports: {
        message:
          "A module's aggregation files compose it: *.module.ts assembles the Layer, the *-handlers.ts maps register handlers on the bus. They may name anything inside their own module — including its adapters, which is the whole point — plus the platform ports and the CQRS vocabulary. They may not reach another module's internals, the database, or the contracts package.",
        external: ["effect", "@effect-server-utils/cqrs"],
        allow: [
          "node:**",
          "@/modules/{module}/**",
          "@/platform/ddd/**",
          "@/platform/ids/**",
          "@/platform/auth/**",
          "@/platform/notifications/**",
          "@/common/**",
        ],
        deny: [
          {
            match: "@/platform/*-live.ts",
            except: ["@/server.ts", "@/platform/cqrs/**", "@/test-utils/**", "**/*.test.ts"],
            message:
              "A Live is wired at a composition root, never named by a use case (ADR-0007). Depend on the port's Tag; the Layer that satisfies it is assembled in server.ts, platform/cqrs/cqrs-runtime.ts or test-utils/.",
          },
          {
            // Module-wide, so it holds for tiers that carry no allowlist too.
            match: "@/modules/*/**",
            matchNot: ["@/modules/{module}/**", "@/modules/*/index.ts"],
            message:
              "A module may only import another module through its index.ts barrel. Reaching into another module's internals couples you to a shape it is free to change; the barrel is the surface it publishes on purpose.",
          },
          {
            match: "@/modules/*/index.ts",
            matchNot: ["@/modules/{module}/index.ts"],
            // The two anti-corruption seams, exempted by the author of the
            // prohibition rather than by the folders themselves — a tier cannot
            // opt itself out of a prohibition.
            except: [
              "@/modules/*/infrastructure/acl/**",
              "@/modules/*/interface/events/**",
              "**/*.test.ts",
            ],
            message:
              "ADR-0022: only a cross-context ACL adapter (infrastructure/acl/) or an inbound event adapter (interface/events/) may name another module's barrel. Everywhere else depends on a consumer-owned port in domain/ports/acl/, whose adapter is the one place the foreign vocabulary appears. A client that reaches into a sibling module is a miscategorised ACL.",
          },
        ],
      },

      children: {
        "index.ts": {
          imports: {
            reset: true,
            message:
              "A module's barrel re-exports from its own module and nowhere else: domain types, message definitions, handler-registration maps and the module's Live layer. It is the surface other modules see, so anything it names becomes public.",
            allow: ["@/modules/{module}/**"],
            deny: [
              {
                match: ["@/modules/*/infrastructure/**", "@/modules/*/interface/**"],
                message:
                  "A module's barrel publishes domain types, message definitions, handler-registration maps and the module's Live layer — never its adapters. Re-exporting from infrastructure/ or interface/ makes a driven or driving adapter part of the module's public surface, which is exactly what the barrel exists to keep private.",
              },
            ],
          },
        },
        "*.module.ts": {},
        "*.command-handlers.ts | *.query-handlers.ts": {},
        "*.event-span-attributes.ts": {},
        "*.shared-deps.ts": {},

        "commands/": {
          message:
            "commands/ holds a <verb-noun>.command.ts schema and its <verb-noun>.handler.ts handler. A shared helper here is a smell — domain logic belongs on an aggregate op (ADR-0023), trivial logic inlines.",

          imports: {
            reset: true,
            message:
              "Module commands (write-side use cases) may only import: their own module's domain and sibling commands, the CQRS library (the message vocabulary a command is declared in — ADR-0006), the unit-of-work library (withUnitOfWork, PersistenceUnavailable), the DDD shared-kernel ports under platform/ddd/, platform/ids/, and platform/notifications/ port files. No platform/*-live.ts (Lives are wired at the composition root), no infrastructure, no interface, no queries, no event-handlers, no @org/contracts (a command's failure channel names domain errors; the endpoint maps them to wire errors — ADR-0004), no @org/database, and no other module's barrel — a cross-module call goes through a domain/ports/acl/ port whose adapter lives in infrastructure/acl/ (ADR-0022).",
            external: ["effect", "@effect-server-utils/cqrs", "@effect-server-utils/unit-of-work"],
            allow: [
              "node:**",
              "@/modules/{module}/domain/**",
              "@/modules/{module}/commands/**",
              "@/platform/ddd/**",
              "@/platform/ids/**",
              "@/platform/notifications/**",
            ],
            deny: [
              {
                // The allow/deny pair is how the manifest says "this folder, but
                // not its Lives" — the nested config needed a lookahead inside
                // the pattern to say the same thing, where the reason could not
                // be read.
                match: "@/platform/notifications/*-live.ts",
                message:
                  "A use case depends on the notification port's Tag, never on the Live that satisfies it (ADR-0007). The Layer is assembled at a composition root.",
              },
            ],
          },

          children: {
            "*.command.ts": {},
            "*.handler.ts": {
              message:
                "Every command handler (*.handler.ts) needs a sibling *.handler.test.ts (use-case unit test with the repository fakes).",
              requires: ["{base}.test.ts"],
            },
            "*.test.ts": testFile,
          },
        },

        "queries/": {
          message:
            "queries/ holds a <verb-noun>.query.ts schema and its <verb-noun>.handler.ts handler.",

          imports: {
            reset: true,
            message:
              "A query builds its own read model: it reads SQL directly through @org/database and must not cross the write-side consistency boundary. From its own domain/ it may take only two things — branded IDs (domain/<sub>/*.id.ts) and cross-context ACL ports (domain/ports/acl/, since ADR-0020 bans cross-schema SQL). Roots, ops, repositories, specifications, value objects, errors and events are off-limits; read-side errors and statuses live in the *.query.ts, not the domain.",
            external: [
              "effect",
              "@org/database",
              "@effect-server-utils/cqrs",
              "@effect-server-utils/unit-of-work",
            ],
            allow: [
              "node:**",
              "@/modules/{module}/queries/**",
              "@/modules/{module}/domain/*/*.id.ts",
              "@/modules/{module}/domain/ports/acl/**",
              "@/platform/ddd/**",
              "@/platform/ids/**",
              "@/platform/translate-database-errors.ts",
              "~/database/**",
            ],
          },

          children: {
            "*.query.ts": {},
            "*.policy-query.ts": {
              message:
                "A *.policy-query.ts is a query this module publishes so OTHER modules' authorization checks can ask it a question (ADR-0022). It is a cross-module contract: changing its shape breaks consumers you cannot see from here, so it carries a stability obligation an internal *.query.ts does not. A query only this module dispatches is a plain *.query.ts.",
            },
            "*.handler.ts": {
              message:
                "Every query handler (*.handler.ts) needs a sibling *.handler.integration.test.ts — queries read real SQL projections, so the parity is on the integration test (seed via the live repository).",
              requires: ["{base}.integration.test.ts"],
            },
            "*.test.ts": testFile,
          },
        },

        "event-handlers/": {
          message:
            "event-handlers/ holds one *.handler.ts per reaction (triggers live in triggers/). Shared logic belongs on an aggregate or domain service.",
          imports: {
            reset: true,
            message:
              "An event handler is a write-side use case that happens to be triggered by an event rather than a command, and it runs in the publisher's fiber and transaction (ADR-0007). Its dependency shape is a command's: its own module's domain, its sibling handlers, the CQRS and unit-of-work vocabulary, the DDD shared kernel, platform IDs and notification ports. No infrastructure, no interface, no queries, no @org/database, no other module's barrel.",
            external: ["effect", "@effect-server-utils/cqrs", "@effect-server-utils/unit-of-work"],
            allow: [
              "node:**",
              "@/modules/{module}/domain/**",
              "@/modules/{module}/event-handlers/**",
              "@/modules/{module}/commands/*.command.ts",
              "@/platform/ddd/**",
              "@/platform/ids/**",
              "@/platform/notifications/**",
            ],
          },
          children: {
            "*.handler.ts": {
              message: "Every event handler (*.handler.ts) needs a sibling *.handler.test.ts.",
              requires: ["{base}.test.ts"],
            },
            "*.test.ts": testFile,
            "triggers/": {
              message:
                "event-handlers/triggers/ holds one <publisher>.triggers.ts per upstream publisher whose events this module reacts to.",
              children: { "*.triggers.ts": {}, "*.test.ts": testFile },
            },
          },
        },

        "sagas/": {
          message:
            "`sagas/` holds long-running process managers only, one `*.saga.ts` per saga (ADR-0002, ADR-0007). A saga correlates SEVERAL eventual events over time and compensates when a later step fails. If one event decides the outcome, it is an inbound event adapter — put it in `interface/events/` instead.",
          imports: {
            reset: true,
            message:
              "A saga is bus-only. It may name its own module's domain events and branded IDs, its own commands' *.command.ts messages, its sibling sagas, and the CQRS library — no repositories, no aggregate ops, no @org/database. A saga runs on its own fiber with no publisher transaction to inherit, so a repository call here would write outside every unit of work.",
            external: ["effect", "@effect-server-utils/cqrs"],
            allow: [
              "@/modules/{module}/domain/*/*.events.ts",
              "@/modules/{module}/domain/*/*.id.ts",
              "@/modules/{module}/commands/*.command.ts",
              "@/modules/{module}/sagas/**",
              "@/platform/ids/**",
            ],
          },
          children: {
            "*.saga.ts": {
              message:
                "Every saga (*.saga.ts) needs a sibling *.saga.test.ts. A saga's whole value is behaviour across several events and over time, which is exactly what nothing else in the suite covers.",
              requires: ["{base}.test.ts"],
            },
            "*.test.ts": testFile,
          },
        },

        "policies/": {
          message:
            "policies/ admits *.policies.ts registries, *.resource-resolver(s).ts, and is-*.policy.ts checks. There is no policies/public/: a module does NOT publish an ACL service for other modules' policies to consume. Cross-module authorization data flows the ADR-0022 way — the module that needs the answer owns a port in domain/ports/acl/ whose adapter dispatches the owning module's published *.policy-query.ts.",
          imports: {
            reset: true,
            message:
              "A policy reads read models only — never a root, a repository or a specification (ADR-0021). Own data comes from dispatching this module's own query; foreign data comes from this module's own domain/ports/acl/ port, whose adapter lives in infrastructure/acl/. A check takes its data source as an argument and the module's contribution closes over it, so every registered check is `R = never`.",
            external: [
              "effect",
              "@effect-server-utils/authz",
              "@effect-server-utils/cqrs",
              "@effect-server-utils/unit-of-work",
            ],
            allow: [
              "@/modules/{module}/policies/**",
              "@/modules/{module}/queries/**",
              "@/modules/{module}/domain/ports/acl/**",
              "@/modules/{module}/infrastructure/acl/**",
              "@/modules/{module}/domain/*/*.id.ts",
              "@/platform/ddd/**",
              "@/platform/ids/**",
              "~/database/**",
              "~/contracts/**",
            ],
          },
          children: {
            "*.policies.ts": {},
            "*.resource-resolver.ts | *.resource-resolvers.ts": {},
            "*.policy.ts": {},
            "*.test.ts": testFile,
          },
        },

        "infrastructure/": {
          message:
            "infrastructure/ is a container: it admits only the adapter buckets repositories/, clients/ and acl/, mirroring domain/ports/ (ADR-0022). No files live directly in infrastructure/. repositories/ holds *.repository-live.ts, *.repository-fake.ts and *.mapper.ts; clients/ holds third-party adapters (*.client-live.ts, *.client-fake.ts, a self-contained *.client.ts, *.email.tsx templates); acl/ holds *.acl-live.ts and *.acl-fake.ts.",

          imports: {
            reset: true,
            message:
              "A driven adapter implements one port. What it may reach depends on which counterpart it adapts to, so each bucket below states its own; this is the floor they share.",
            external: ["effect"],
            allow: ["node:**", "@/platform/ids/**"],
            deny: [
              {
                match: "@/modules/*/interface/**",
                message:
                  "The infrastructure layer must not depend on the interface layer. Both are adapters on opposite sides of the hexagon: inbound (interface) drives the application, outbound (infrastructure) is driven by it. An adapter reaching across is a shortcut around the use case in the middle.",
              },
            ],
          },

          children: {
            "repositories/": {
              imports: {
                message:
                  "A repository adapts the module's own aggregates to its own datastore. It may name its module's domain, its sibling repository files, the persistence kernel and @org/database — and nothing else. It never reaches another module, the contracts package, or a third-party SDK.",
                allow: [
                  "@/modules/{module}/domain/**",
                  "@/modules/{module}/infrastructure/repositories/**",
                  "@/platform/ddd/contracts/**",
                  "@/platform/persistence/**",
                  "@/platform/translate-database-errors.ts",
                  "~/database/**",
                ],
                deny: [
                  {
                    match: [
                      "@/modules/*/commands/**",
                      "@/modules/*/queries/**",
                      "@/platform/ddd/event-bus.ts",
                    ],
                    message:
                      "A repository is dumb persistence (ADR-0005). It must not import the module's own use cases or the application-tier buses — a repository that reaches for these is smuggling orchestration into persistence. Return the rows; let the use case decide what they mean.",
                  },
                ],
              },
              children: {
                "*.repository-live.ts": {},
                "*.repository-fake.ts": {},
                "*.mapper.ts": {},
                "*.test.ts": testFile,
              },
            },

            "clients/": {
              imports: {
                message:
                  "A client adapts a true third-party system. It is the one tier whose external dependencies are the point, so they are enumerated here: adding an SDK is an edit to this list, in the open. It may also name its module's domain and client ports, the notification ports, and the contracts package for wire shapes.",
                external: [
                  "stripe",
                  "openid-client",
                  "react",
                  "@react-email/components",
                  "@react-email/render",
                ],
                allow: [
                  "@/modules/{module}/domain/**",
                  "@/modules/{module}/infrastructure/clients/**",
                  "@/common/**",
                  "@/platform/notifications/**",
                  "~/contracts/**",
                ],
              },
              children: {
                "*.client-live.ts": {},
                "*.client-fake.ts": {},
                "*.client.ts": {},
                "*.email.tsx": {},
                "*.test.ts | *.test.tsx": testFile,
              },
            },

            // One of the two folders allowed to name another module's barrel —
            // this is the anti-corruption seam (ADR-0022), so the foreign
            // vocabulary is meant to stop here.
            "acl/": {
              imports: {
                message:
                  "An ACL adapter is the one place a module's foreign vocabulary appears (ADR-0022): it names another module's barrel and translates what comes back into this module's own acl port. It needs nothing else — no repositories, no use cases, no database.",
                allow: ["@/modules/*/index.ts", "@/modules/{module}/domain/ports/acl/**"],
              },
              children: {
                "*.acl-live.ts": {},
                "*.acl-fake.ts": {},
                "*.test.ts": testFile,
              },
            },
          },
        },

        "interface/": {
          message:
            "interface/ is a container: it admits one subfolder per inbound protocol — http/, cli/ and events/ (ADR-0013, ADR-0007). No files live directly in interface/. http/ and cli/ hold one *.endpoint.ts per endpoint, plus an index.ts barrel and pure leaf *.util.ts helpers; events/ holds one *.event-adapter.ts per upstream module whose domain events this module consumes.",

          children: {
            "http/ | cli/": {
              imports: {
                reset: true,
                message:
                  "An inbound adapter translates the wire into a use case: it may name its own module's commands, queries and policies, the contracts it implements, the platform's HTTP and auth surface, and a module-owned service its endpoints consume. It may not reach its own repositories or aggregates directly — that is what the use case in the middle is for — nor another module's internals.",
                external: ["effect", "@effect-server-utils/cqrs", "cookie"],
                allow: [
                  "node:**",
                  "@/platform/api.ts",
                  "@/common/**",
                  "@/platform/http-endpoint.ts",
                  "@/platform/request-context.ts",
                  "@/platform/auth/**",
                  "@/platform/ddd/**",
                  "@/platform/ids/**",
                  "@/modules/{module}/commands/**",
                  "@/modules/{module}/queries/**",
                  "@/modules/{module}/policies/**",
                  "@/modules/{module}/interface/**",
                  "@/modules/{module}/domain/**",
                  "@/modules/{module}/infrastructure/clients/**",
                  "~/contracts/**",
                ],
              },
              children: {
                "index.ts": {},
                "*.endpoint.ts": {
                  message:
                    "Every endpoint (*.endpoint.ts) needs a real *.endpoint.integration.test.ts (ADR-0013) that exercises the HTTP layer against a live DB via useServerTestRuntime.",
                  requires: ["{base}.integration.test.ts"],
                  // The OIDC flow endpoints keep unit-token coverage: their happy
                  // path needs a live IdP and is covered by Playwright plus the
                  // SessionRepositoryLive integration test.
                  requiresNot: ["login.endpoint.ts", "logout.endpoint.ts"],
                },
                "*.util.ts": {
                  message:
                    "An interface *.util.ts is a pure leaf helper (ADR-0023); its sibling *.util.test.ts is the anti-drift guard — the extraction must be justified by a unit test.",
                  requires: ["{base}.test.ts"],
                  imports: {
                    reset: true,
                    message:
                      "An interface *.util.ts is a leaf (ADR-0023): pure protocol or wire plumbing. No ports, no use cases, no infrastructure, no buses, no module barrel — if it needs any of those it is not a util, it is the endpoint's own work or a use case that has not been named yet. Effect and the node builtins are all it gets.",
                    external: ["effect"],
                    allow: ["node:**"],
                  },
                },
                "*.test.ts": testFile,
              },
            },

            "events/": {
              message:
                "interface/events/ holds one *.event-adapter.ts per upstream module whose domain events this module consumes (ADR-0007 ACL).",
              imports: {
                reset: true,
                message:
                  "An inbound event adapter is an anti-corruption seam: it may name its own module's domain events and branded IDs, its own commands' *.command.ts messages, another module's index.ts barrel (this is one of the two folders allowed to), and the DDD shared kernel. Nothing else — the foreign vocabulary stops here, translated into a command this module already understands.",
                external: ["effect", "@effect-server-utils/cqrs"],
                allow: [
                  "@/modules/{module}/domain/*/*.events.ts",
                  "@/modules/{module}/domain/*/*.id.ts",
                  "@/modules/{module}/commands/*.command.ts",
                  "@/modules/*/index.ts",
                  "@/platform/ddd/**",
                  "@/platform/ids/**",
                ],
              },
              children: {
                "*.event-adapter.ts": {
                  message:
                    "Every event adapter (*.event-adapter.ts) needs a sibling *.event-adapter.test.ts (ADR-0007 ACL).",
                  requires: ["{base}.test.ts"],
                },
                "*.test.ts": testFile,
              },
            },
          },
        },

        "domain/": {
          message:
            "domain/ is a container: it admits only subdomain folders (one per aggregate/consistency boundary), domain-services/ (cross-subdomain domain services), and ports/ (clients/ + acl/). No files live directly in domain/ — put the stereotype inside its subdomain folder.",

          // The whole of `domain-isolation` and `domain-no-external-beyond-effect`,
          // stated once, as an allowlist. Everything those rules listed as
          // forbidden is simply absent from here.
          imports: {
            reset: true,
            message:
              "Module domain may only import from its own subdomain, effect (external), the DDD kernel's contracts tier (platform/ddd/contracts/), and platform/ids/ for branded entity IDs referenced cross-module (ADR-0002). The domain does not name @effect-server-utils/cqrs or @effect-server-utils/unit-of-work at all: their domain-safe modules are re-exported under this application's vocabulary from platform/ddd/contracts/, and the buses and UnitOfWork are deliberately NOT — admitting them here would let a domain/ports/ port name a bus in its requirement channel. No contracts package, no cross-module domain, no infrastructure/commands/queries/event-handlers/interface.",
            external: ["effect"],
            allow: ["node:**", "@/platform/ddd/contracts/**", "@/platform/ids/**"],
          },

          children: {
            "domain-services/": {
              message:
                "domain/domain-services/ holds only *.domain-service.ts (+ its *.domain-service.test.ts): stateless domain logic that spans subdomains (ADR-0023), the one domain location allowed to compose more than one subdomain. Logic an aggregate owns belongs on that aggregate's *.root-ops.ts in its subdomain folder.",
              // The one domain folder allowed to reach across subdomains.
              imports: { allow: ["@/modules/{module}/domain/**"] },
              children: {
                "*.domain-service.ts": {
                  message:
                    "A domain service is real domain logic (ADR-0023), so it needs a sibling *.domain-service.test.ts.",
                  requires: ["{base}.test.ts"],
                },
                "*.test.ts": testFile,
              },
            },

            "ports/": {
              message:
                "domain/ports/ is a container: it admits only the tier subfolders clients/ (adapters to true third-party systems) and acl/ (anti-corruption ports to other bounded contexts) — ADR-0022. No files live directly in ports/. A repository port is not here either: it lives inside its own subdomain folder as domain/<subdomain>/*.repository.ts.",
              children: {
                "clients/": {
                  message:
                    "domain/ports/clients/ holds one *.client.ts per third-party system this module talks to (ADR-0022).",
                  children: {
                    "*.client.ts": {
                      message:
                        "Every client port (*.client.ts) needs a *.client-live.ts, a *.client-fake.ts, and a *.client-live.test.ts in ../../../infrastructure/clients/. (A self-contained client with no port lives directly in infrastructure/clients/ as *.client.ts and is not required here.)",
                      requires: [
                        "../../../infrastructure/clients/{base}-live.ts",
                        "../../../infrastructure/clients/{base}-fake.ts",
                        "../../../infrastructure/clients/{base}-live.test.ts",
                      ],
                      // Stated here rather than as a distant rule whose `from`
                      // side grows an exclusion for every new caller.
                      importedBy: {
                        message:
                          "An outbound port (domain/ports/clients/, domain/ports/repositories/) is consumed by the module's own use cases and by the infrastructure adapter that implements it — nothing else. A policy, an endpoint or another module reaching for one is bypassing the use-case boundary: dispatch a command or query instead. ACL ports are a separate case with their own rule.",
                        allow: portConsumers,
                      },
                    },
                  },
                },

                "acl/": {
                  message:
                    "domain/ports/acl/ holds one *.acl.ts per other bounded context this module needs an answer from (ADR-0022).",
                  children: {
                    "*.acl.ts": {
                      message:
                        "Every ACL port (*.acl.ts) needs a *.acl-live.ts, a *.acl-fake.ts, and a *.acl-live.test.ts in ../../../infrastructure/acl/.",
                      requires: [
                        "../../../infrastructure/acl/{base}-live.ts",
                        "../../../infrastructure/acl/{base}-fake.ts",
                        "../../../infrastructure/acl/{base}-live.test.ts",
                      ],
                      importedBy: {
                        message:
                          "An ACL port (domain/ports/acl/) is consumed by the module's own use cases, its policies (a check takes its data source as an argument, and the module's contribution closes over this port), and the infrastructure adapter that implements it — nothing else.",
                        allow: aclPortConsumers,
                      },
                    },
                  },
                },
              },
            },

            // Each subdomain folder — one per aggregate. The named folders above
            // are matched first, so this catch-all is only ever a subdomain.
            "{subdomain}/": {
              message:
                "A subdomain folder under domain/ admits its DDD stereotypes: *.root.ts (dumb data) + *.root-ops.ts, *.aggregate.ts / *.entity.ts / *.value-object.ts + their *-ops.ts bags, *.id.ts, *.errors.ts, *.events.ts, *.specification.ts, the subdomain's *.repository.ts port, and a value-objects/ subfolder. A free-standing helper is a smell — model it as an op or a *.specification.ts. Domain services do NOT live here (they span subdomains → domain/domain-services/); clients/acl ports live in domain/ports/.",

              // `subdomain-isolation`, as the narrowing it actually is: a
              // subdomain sees itself, and what domain/ already allowed.
              imports: {
                message:
                  "Within a module's domain, each subdomain folder is a boundary: it may import only its own subdomain, plus effect, platform/ddd/contracts and platform/ids. It may NOT import another subdomain, domain/domain-services/, or domain/ports/. Cross-subdomain composition is the job of a domain service in domain/domain-services/.",
                allow: ["@/modules/{module}/domain/{subdomain}/**"],
              },

              children: {
                // A subdomain folder is the aggregate, so its root carries the
                // folder's own name: todo/ holds todo.root.ts. A root named
                // anything else means the folder holds two aggregates, or the
                // wrong one.
                "*.root.ts": { name: { like: "{subdomain}" } },
                "*.root-ops.ts": {
                  message:
                    "An aggregate root's operations bag (*.root-ops.ts) owns the invariants, so it carries the test-parity obligation: add the sibling *.root-ops.test.ts. (The *.root.ts data class is a dumb Schema and needs no test.)",
                  requires: ["{base}.test.ts"],
                  importedBy: {
                    message:
                      "ADR-0003: *.root-ops.ts is the aggregate's mutation surface — the one op stereotype that escapes the domain. It may be imported only by the module's own command handlers (commands/*.handler.ts), its own domain/ (invariant guards and sub-op composition), tests, and repository fakes (a test seam). A query, event adapter, interface endpoint, or infrastructure Live reaching for root-ops is bypassing the command boundary — dispatch a command instead, or (for a read predicate) use a *.specification.ts.",
                    allow: [
                      "@/modules/*/domain/**",
                      "@/modules/*/commands/*.handler.ts",
                      "**/*.test.ts",
                      "**/*.repository-fake.ts",
                    ],
                  },
                },
                "*.aggregate.ts": {},
                "*.entity.ts": {},
                "*.value-object.ts": {},
                "*.aggregate-ops.ts | *.entity-ops.ts | *.value-object-ops.ts": constituentOps,
                "*.id.ts": {},
                "*.errors.ts": {},
                "*.events.ts": {},
                "*.specification.ts": specification,
                "*.repository.ts": {
                  message:
                    "Every repository port (*.repository.ts) needs its infrastructure trio: a *.repository-live.ts, a *.repository-fake.ts, and a *.repository-live.integration.test.ts in ../../infrastructure/repositories/.",
                  requires: [
                    "../../infrastructure/repositories/{base}-live.ts",
                    "../../infrastructure/repositories/{base}-fake.ts",
                    "../../infrastructure/repositories/{base}-live.integration.test.ts",
                  ],
                  importedBy: {
                    message:
                      "An outbound port is consumed by the module's own use cases and by the infrastructure adapter that implements it — nothing else. A policy, an endpoint or another module reaching for one is bypassing the use-case boundary: dispatch a command or query instead.",
                    allow: [
                      "@/modules/*/domain/**",
                      "@/modules/*/commands/**",
                      "@/modules/*/queries/**",
                      "@/modules/*/event-handlers/**",
                      "@/modules/*/sagas/**",
                      "@/modules/*/infrastructure/**",
                      "@/modules/*/*.shared-deps.ts",
                      "@/modules/*/*.module.ts",
                      "@/test-utils/**",
                      "**/*.test.ts",
                    ],
                  },
                  // Both halves of the dumb-persistence vocabulary, each with the
                  // advice that fits its half.
                  members: [
                    {
                      message:
                        'Repository port method "{name}" is not in the dumb-persistence vocabulary (ADR-0005). A read is only findOne/findMany taking a Specification — turn this lookup or variant into a Specification the caller composes (e.g. repo.findOne(XSpecifications.withId(id))), so the rule lives in one place and the fake filters with the same object the live query uses. There are no keyed or variant finders.',
                      subject: "type-members",
                      in: "*Repository*",
                      match: "find*",
                      allow: ["findOne", "findMany"],
                    },
                    {
                      message:
                        'Repository port method "{name}" is not in the dumb-persistence vocabulary (ADR-0005). It reads like a domain verb — put that behaviour on the aggregate and have the use case persist the result. A port declares only insertOne/insertMany, updateOne/updateMany, deleteOne/deleteMany, upsertOne/upsertMany, and findOne/findMany.',
                      subject: "type-members",
                      in: "*Repository*",
                      matchNot: "find*",
                      allow: [
                        "insertOne",
                        "insertMany",
                        "updateOne",
                        "updateMany",
                        "deleteOne",
                        "deleteMany",
                        "upsertOne",
                        "upsertMany",
                      ],
                    },
                  ],
                },
                "*.test.ts": testFile,

                "value-objects/": {
                  message:
                    "A value-objects/ folder under a subdomain admits *.value-object.ts, its *.value-object-ops.ts bag, *.specification.ts, and tests.",
                  children: {
                    "*.value-object.ts": {},
                    "*.value-object-ops.ts": constituentOps,
                    "*.specification.ts": specification,
                    "*.test.ts": testFile,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
