// Part of the architecture policy. The root manifest at architecture.config.mjs
// composes this with the other areas; everything here is written against
// repo-relative paths, so the patterns read the same wherever the file lives.

// What a file may export, stated once and applied at every root. A default
// export has no canonical name — every importer invents one and the symbol
// becomes ungreppable — so it is admitted only where a framework demands one,
// and each exemption is listed beside the rule that grants it.
export const noDefaultExports = (except = []) => ({
  message:
    "No default exports: a default has no canonical name, so every importer invents one and the symbol becomes ungreppable. Export it by name. Only a file a framework requires a default from — a Next route, a migration, a story, a vitest globalSetup — is exempt, and the exemption is listed beside this rule in the manifest.",
  kinds: ["default"],
  except: ["**/vitest.config.ts", ...except],
});

// Nothing may import a test, so an export from one has no consumer. A fixture
// two tests share belongs in a harness beside them.
export const testExportsNothing = {
  message:
    "A test exports nothing. Nothing may import a test, so an export here has no consumer; a fixture two tests share belongs in a harness beside them, not inside one of them.",
  count: { max: 0 },
};

// The frontend test node, shared by @org/web and @org/components: a test there
// reaches its harness, the component library and the contracts — never the
// server. It lives at the packages/ level because both tiers use it and neither
// owns it.
export const frontendTestFile = {
  surface: [testExportsNothing],
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

// The six packages with no internal tiers of their own: each one states what it
// may reach and leaves its file layout open.
export const leafPackages = {
  "~/contracts/": {
    message:
      "@org/contracts holds the shared HTTP API contracts, schemas and errors, consumed by the server and every client. It is the root of the dependency graph.",
    layout: "open",
    surface: [noDefaultExports()],
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
    // The migrator loads each migration by its default export.
    surface: [noDefaultExports(["~/database/src/migrations/**"])],
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
    surface: [noDefaultExports()],
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
    surface: [noDefaultExports()],
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
    surface: [noDefaultExports()],
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
    // vitest loads a globalSetup by its default export.
    surface: [noDefaultExports(["~/jobs/src/test-utils/global-setup.ts"])],
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
};
