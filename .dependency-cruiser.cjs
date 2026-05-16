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
        "Module event-handlers are write-side use cases reacting to internal triggers (event-handlers/triggers/*). Cross-module events arrive translated to triggers via `interface/events/<publisher>-event-adapter.ts` (ADR-0007 ACL). Same constraints as commands: own module's domain and sibling event-handlers, platform shared kernel facades. No infrastructure, no interface, no commands, no queries, no @org/contracts, no @org/database, no other-module barrels. Test files excluded.",
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
    // ── Web rules (ADR-0014, ADR-0015) ─────────────────────────────────
    // View-tiering and component-library guarantees, ported from the
    // pre-Next SPA (`packages/client/src/`) to the Next App Router
    // layout (`packages/web/`, no `src/` wrapper, `app/` framework
    // surface added). Run via the second pass in `lint:deps` against
    // `tsconfig.depcruise-web.json`.
    {
      name: "web-tanstack-allowlist",
      severity: "error",
      comment:
        "TanStack Query (@tanstack/react-query, @tanstack/query-core) may only be imported by services/data-access/, services/common/query-client.ts, services/runtime.client.tsx, lib/tanstack-query/, lib/query-client.{shared,server}.ts, app/providers.tsx (the QueryClientProvider mount), and shared test helpers in test/. App Router pages do NOT import TanStack directly — they compose `<ServerHydrationBoundary>` (from lib/tanstack-query/) with per-feature prefetch helpers from services/data-access/. Test/story files exempted. ADR-0014.",
      from: {
        path: "^packages/web/",
        pathNot: [
          "^packages/web/services/data-access/",
          "^packages/web/services/common/query-client\\.ts$",
          "^packages/web/services/runtime\\.client\\.tsx$",
          "^packages/web/lib/tanstack-query/",
          "^packages/web/lib/query-client\\.(shared|server)\\.ts$",
          "^packages/web/app/providers\\.tsx$",
          "^packages/web/test/",
          "\\.(stories|test|spec)\\.(ts|tsx)$",
        ],
      },
      to: { path: "/node_modules/@tanstack/(react-query|query-core)/" },
    },
    {
      name: "web-app-no-tanstack-internals",
      severity: "error",
      comment:
        "App Router pages must consume the data-access port (per-feature `prefetch*` helpers + `use*Suspense` hooks) and the `<ServerHydrationBoundary>` component, not the TanStack glue beneath them. Reaching for `prefetchEffectQuery` (lib/tanstack-query/effect-prefetch.server.ts) or the per-request `getQueryClient` (lib/query-client.server.ts) from `app/` skips the data-access port that ADR-0014 requires. The boundary component encapsulates both. ADR-0014, ADR-0018.",
      from: { path: "^packages/web/app/" },
      to: {
        path: [
          "^packages/web/lib/tanstack-query/effect-prefetch\\.server\\.ts$",
          "^packages/web/lib/query-client\\.server\\.ts$",
        ],
      },
    },
    {
      name: "web-component-no-effect-runtime",
      severity: "error",
      comment:
        "Components in features/ may not import Effect runtime primitives. Reaching for Effect/Stream/Fiber/Ref/SubscriptionRef/Layer/Scope/Runtime/ManagedRuntime/Cause/Exit/Match means extracting to a presenter (*.presenter.{ts,tsx}) or view-model (*.view-model.ts). Allowed effect modules in components: Schema, Function, Either, Option, Predicate, Duration. App Router files (app/) are framework-coupled and exempt. See ADR-0014.",
      from: {
        path: "^packages/web/features/.*\\.tsx$",
        pathNot: [
          "^packages/web/features/.*\\.presenter\\.tsx$",
          "\\.(stories|test|spec)\\.(ts|tsx)$",
        ],
      },
      to: {
        path: "/node_modules/effect/.*/(Effect|Stream|Fiber|Ref|SubscriptionRef|Layer|Scope|Runtime|ManagedRuntime|Cause|Exit|Match)\\.",
      },
    },
    {
      name: "web-react-form-presenter-only",
      severity: "error",
      comment:
        "React-coupled form libraries (@tanstack/react-form, react-hook-form) may only be imported by *.presenter.{ts,tsx} files in features/ and shared form helpers in lib/tanstack-query/. Importing useForm directly from a feature component is the ADR-0014 violation that triggered this rule — extract the form orchestration to a sibling presenter and consume the returned form instance from JSX. Test files exempted.",
      from: {
        path: "^packages/web/",
        pathNot: [
          "^packages/web/features/.*\\.presenter\\.(ts|tsx)$",
          "^packages/web/lib/tanstack-query/",
          "\\.(stories|test|spec)\\.(ts|tsx)$",
        ],
      },
      to: { path: "/node_modules/(@tanstack/react-form|react-hook-form)/" },
    },
    {
      name: "web-ui-libs-only-in-components-or-toast",
      severity: "error",
      comment:
        "Third-party visual libraries (@radix-ui/*, lucide-react, recharts, sonner) live with the bespoke component library in @org/components. Web code may not import them directly — consume the wrapped primitive instead. Sole exception: services/common/toast.ts is the imperative sonner adapter and dispatches Effect Toast calls to the sonner runtime. Test files exempted. See ADR-0015.",
      from: {
        path: "^packages/web/",
        pathNot: [
          "^packages/web/services/common/toast\\.ts$",
          "\\.(stories|test|spec)\\.(ts|tsx)$",
        ],
      },
      to: { path: "/node_modules/(@radix-ui/|lucide-react/|recharts/|sonner/)" },
    },
    // ── @org/components rules (ADR-0015) ───────────────────────────────
    // Run via the same web depcruise pass — `tsconfig.depcruise-web.json`
    // resolves both `@/*` (web) and `@org/components/*` (components),
    // so cross-package edges show up in the cruise.
    {
      name: "components-primitives-only-touch-ui-libs",
      severity: "error",
      comment:
        "Third-party visual libraries (@radix-ui/*, lucide-react, recharts, sonner) may only be imported from packages/components/primitives/. Patterns consume them via the primitives layer so the third-party prop surface stays encapsulated. Class-name utilities (clsx, tailwind-merge, class-variance-authority) are not subject to this rule. Test/story files exempted. See ADR-0015.",
      from: {
        path: "^packages/components/",
        pathNot: ["^packages/components/primitives/", "\\.(stories|test|spec)\\.(ts|tsx)$"],
      },
      to: { path: "/node_modules/(@radix-ui/|lucide-react/|recharts/|sonner/)" },
    },
    {
      name: "components-patterns-no-features",
      severity: "error",
      comment:
        "@org/components/patterns/ may not import from any feature tree. The dependency direction is features → patterns → primitives, never reversed; @org/components must not depend on @org/web at all. See ADR-0015.",
      from: { path: "^packages/components/patterns/" },
      to: { path: "^packages/web/features/|^@org/web/" },
    },
    {
      name: "components-no-web-dep",
      severity: "error",
      comment:
        "@org/components is a leaf workspace package. It must not import @org/web (or anything under packages/web/) — components are consumed by web, not the reverse. Class-name utilities live inside the package (lib/utils/cn.ts). Test/story files exempted.",
      from: {
        path: "^packages/components/",
        pathNot: "\\.(stories|test|spec)\\.(ts|tsx)$",
      },
      to: { path: "^packages/web/|^@org/web($|/)" },
    },
    {
      name: "web-view-model-no-react",
      severity: "error",
      comment:
        "ViewModels (*.view-model.ts) are framework-agnostic. They may not import react, react-dom, or any React-coupled package (@tanstack/react-*, react-hook-form, etc.). If you need React or a React-coupled library, use a presenter instead. See ADR-0014.",
      from: {
        path: "^packages/web/features/.*\\.view-model\\.ts$",
        pathNot: "\\.(stories|test|spec)\\.(ts|tsx)$",
      },
      to: {
        path: "/node_modules/(react|react-dom|@tanstack/react-|react-hook-form)",
      },
    },
    {
      name: "web-no-cross-feature-imports",
      severity: "error",
      comment:
        "Features under packages/web/features/ may not import each other. Cross-feature data flows belong in `services/data-access/`; shared rendering primitives belong in `@org/components/patterns/`. The feature boundary is the same kind of seam the server uses between modules.",
      from: { path: "^packages/web/features/([^/]+)/" },
      to: {
        path: "^packages/web/features/([^/]+)/",
        pathNot: "^packages/web/features/$1/",
      },
    },
    {
      name: "web-features-not-from-app",
      severity: "error",
      comment:
        "Routes under packages/web/app/ compose features; features must not import app/ pages, layouts, or providers. The dependency direction is app → features, never reversed. Server-only or shared infra files in app/ are not feature dependencies — promote them to /services or /lib first.",
      from: { path: "^packages/web/features/" },
      to: { path: "^packages/web/app/" },
    },
    {
      name: "platform-ids-effect-only",
      severity: "error",
      comment:
        "platform/ids/ is the minimal shared kernel for cross-module branded entity " +
        "IDs (ADR-0020). It may only depend on `effect` from third-party packages. " +
        "Drizzle column types, validation libs, contract schemas, etc. do not belong " +
        "here — they leak module-internal shape into the shared kernel.",
      from: { path: "^packages/server/src/platform/ids/" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/effect/",
      },
    },
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
    doNotFollow: { path: "node_modules|storybook-static|\\.next" },
    exclude: { path: "storybook-static|\\.next" },
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
