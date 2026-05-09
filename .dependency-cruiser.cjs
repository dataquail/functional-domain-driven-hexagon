/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-domain-to-server",
      comment: "packages/contracts must not depend on packages/server",
      severity: "error",
      from: { path: "^packages/contracts/src/" },
      to: { path: "^packages/server/" },
    },
    {
      name: "no-domain-to-database",
      comment: "packages/contracts must not depend on packages/database",
      severity: "error",
      from: { path: "^packages/contracts/src/" },
      to: { path: "^packages/database/" },
    },
    {
      name: "module-barrel-only-cross-module",
      severity: "error",
      comment:
        "A module may only import another module via its index.ts barrel. Applies automatically to any new folder under src/modules/.",
      from: { path: "^packages/server/src/modules/([^/]+)/" },
      to: {
        path: "^packages/server/src/modules/([^/]+)/",
        pathNot: [
          "^packages/server/src/modules/$1/",
          "^packages/server/src/modules/[^/]+/index\\.ts$",
        ],
      },
    },
    {
      name: "module-barrel-only-from-outside",
      severity: "error",
      comment: "Files outside src/modules must import a module via its index.ts barrel.",
      from: {
        path: "^packages/",
        pathNot: "^packages/server/src/modules/[^/]+/",
      },
      to: {
        path: "^packages/server/src/modules/[^/]+/",
        pathNot: "^packages/server/src/modules/[^/]+/index\\.ts$",
      },
    },
    {
      name: "domain-isolation",
      severity: "error",
      comment:
        "Module domain may only import from its own folder, effect (external), and the platform shared kernel (`domain-event.ts` for the event factory; `span-attributable.ts` for the cross-cutting `SpanAttributesExtractor` type used by event extractor signatures; `platform/ids/` for branded entity IDs referenced cross-module — see ADR-0002). No contracts, no cross-module domain, no infrastructure/commands/queries/event-handlers/interface.",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: {
        path: "^packages/",
        pathNot:
          "/domain/|^packages/server/src/platform/domain-event\\.ts$|^packages/server/src/platform/span-attributable\\.ts$|^packages/server/src/platform/ids/",
      },
    },
    {
      name: "domain-no-external-beyond-effect",
      severity: "error",
      comment:
        "Module domain may only use 'effect' as an external dependency. No drizzle, no pg, no HTTP framework — keep the domain runtime-pure.",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/effect/",
      },
    },
    {
      name: "commands-isolation",
      severity: "error",
      comment:
        "Module commands (write-side use cases) may only import: own module's domain and sibling commands, the platform shared kernel facades (command/query/event buses, transaction runner, span attributable, domain-event), and other modules' barrel (events). No infrastructure, no interface, no queries, no event-handlers, no @org/contracts, no @org/database. Test files excluded.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/commands/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/(domain|commands)/",
          "^packages/server/src/platform/(command-bus|query-bus|domain-event-bus|domain-event|transaction-runner|span-attributable)\\.ts$",
          "^packages/server/src/platform/ids/",
          "^packages/server/src/modules/[^/]+/index\\.ts$",
        ],
      },
    },
    {
      name: "commands-no-external-beyond-effect",
      severity: "error",
      comment:
        "Commands are runtime-pure: only 'effect' allowed externally. No drivers, no clients, no framework code.",
      from: {
        path: "^packages/server/src/modules/[^/]+/commands/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/effect/",
      },
    },
    {
      name: "event-handlers-isolation",
      severity: "error",
      comment:
        "Module event-handlers are write-side reactions to events. Same constraints as commands: own module's domain and sibling event-handlers, platform shared kernel facades, and other modules' barrel (events). No infrastructure, no interface, no commands, no queries, no @org/contracts, no @org/database. Test files excluded.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/event-handlers/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/(domain|event-handlers)/",
          "^packages/server/src/platform/(command-bus|query-bus|domain-event-bus|domain-event|transaction-runner|span-attributable)\\.ts$",
          "^packages/server/src/platform/ids/",
          "^packages/server/src/modules/[^/]+/index\\.ts$",
        ],
      },
    },
    {
      name: "event-handlers-no-external-beyond-effect",
      severity: "error",
      comment:
        "Event handlers are runtime-pure: only 'effect' allowed externally. No drivers, no clients, no framework code.",
      from: {
        path: "^packages/server/src/modules/[^/]+/event-handlers/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/effect/",
      },
    },
    {
      name: "queries-isolation",
      severity: "error",
      comment:
        "Module queries are read-side: may import own module's domain (for IDs/value objects) and sibling queries, the platform shared kernel facades, other modules' barrel, and @org/database for direct SQL projection. May NOT import own commands, event-handlers, infrastructure, interface, or @org/contracts (wire types belong in interface). Test files excluded.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/queries/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/(domain|queries)/",
          "^packages/server/src/platform/(command-bus|query-bus|domain-event-bus|domain-event|transaction-runner|span-attributable)\\.ts$",
          "^packages/server/src/platform/ids/",
          "^packages/server/src/modules/[^/]+/index\\.ts$",
          "^packages/database/",
        ],
      },
    },
    {
      name: "queries-no-external-beyond-effect-and-database",
      severity: "error",
      comment:
        "Queries may use 'effect' and the workspace database package. No other npm drivers/clients/frameworks.",
      from: {
        path: "^packages/server/src/modules/[^/]+/queries/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/(effect|@org/database)/",
      },
    },
    {
      name: "barrel-content-discipline",
      severity: "error",
      comment:
        "Module barrel (index.ts) defines the cross-module public surface. It must not re-export anything from infrastructure/ or interface/ — those are private implementation details.",
      from: { path: "^packages/server/src/modules/[^/]+/index\\.ts$" },
      to: {
        path: "^packages/server/src/modules/[^/]+/(infrastructure|interface)/",
      },
    },
    {
      name: "no-infrastructure-to-interface",
      severity: "error",
      comment: "Module infrastructure layer must not depend on its interface layer",
      from: { path: "^packages/server/src/modules/[^/]+/infrastructure/" },
      to: { path: "^packages/server/src/modules/[^/]+/interface/" },
    },
    // ── Client rules (ADR-0014) ────────────────────────────────────────
    // The view-tiering / component-library rules from packages/client/
    // (ADR-0014, ADR-0015) need re-translation to the packages/web/
    // layout (top-level features/, components/, lib/, services/ — no
    // src/ wrapper, plus client/server file naming for Next conventions).
    // Tracked as a Phase 6 cutover follow-up; see migration plan.
    {
      name: "no-circular",
      severity: "error",
      comment:
        "This dependency is part of a circular relationship. You might want to revise " +
        "your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-spec",
      comment:
        "This module depends on a spec (test) file. The sole responsibility of a spec file is to test code.",
      severity: "error",
      from: {},
      to: { path: "\\.(spec|test)\\.(js|mjs|cjs|ts|tsx)$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["main", "types"],
    },
    reporterOptions: {
      archi: {
        collapsePattern: "^(packages|src|lib|app|bin|test(s?)|spec(s?))/[^/]+|node_modules/[^/]+",
      },
      text: { highlightFocused: true },
    },
  },
};
