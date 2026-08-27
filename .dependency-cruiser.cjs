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
      name: "foreign-barrel-only-from-outbound-adapter",
      severity: "error",
      comment:
        "ADR-0022. Within a module, only cross-context ACL adapters (`infrastructure/acl/`) and inbound event adapters (`interface/events/`) may import another module's `index.ts` barrel. Everywhere else — commands, queries, event-handlers, domain, interface, and the third-party `infrastructure/clients/` adapters — depends on a consumer-owned port in `domain/ports/acl/`, whose adapter in `infrastructure/acl/` is the one place the foreign command/query/error vocabulary appears. Note `infrastructure/clients/` (adapters to true third-party systems) is deliberately NOT whitelisted: a client that reaches into a sibling module is a miscategorized ACL. This narrows (does not replace) `module-barrel-only-cross-module`: the barrel is still the only legal target; this restricts which consumer folders may aim at a *foreign* one. Same-module barrel imports and test files are exempt.",
      from: {
        // The whitelist is folder-type-based, so it uses `[^/]+` rather than
        // a `$1` backreference: a `$1` in `from.pathNot` does not resolve
        // against the `from.path` capture (only the `to` side does). The
        // capture group remains for the `to.pathNot` own-barrel exemption.
        path: "^packages/server/src/modules/([^/]+)/",
        pathNot: [
          "^packages/server/src/modules/[^/]+/infrastructure/acl/",
          "^packages/server/src/modules/[^/]+/interface/events/",
          "\\.test\\.ts$",
        ],
      },
      to: {
        path: "^packages/server/src/modules/[^/]+/index\\.ts$",
        pathNot: "^packages/server/src/modules/$1/index\\.ts$",
      },
    },
    {
      name: "domain-isolation",
      severity: "error",
      comment:
        "Module domain may only import from its own folder, effect (external), the DDD kernel's *contracts* tier (`platform/ddd/contracts/`), and `platform/ids/` for branded entity IDs referenced cross-module (ADR-0002). The domain does not name `@effect-server-utils/cqrs` or `@effect-server-utils/unit-of-work` at all: their domain-safe modules (the event vocabulary, `PersistenceUnavailable`) are re-exported under this application's vocabulary from `platform/ddd/contracts/`, and the buses and `UnitOfWork` are deliberately NOT — admitting them here would let a `domain/ports/` port name a bus in its requirement channel, the exclusion ADR-0006's per-module dispatch surfaces depend on. Tiering by folder rather than by package path is what keeps this rule independent of a library's internal file layout, and is why nothing here changed when the libraries moved from workspace packages to installed ones, nor when the unit of work was split out of the CQRS package — the domain never named it either way; `domain-no-external-beyond-effect` is what holds the line now. No contracts package, no cross-module domain, no infrastructure/commands/queries/event-handlers/interface. See ADR-0008.",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: {
        path: "^packages/",
        pathNot:
          "/domain/|^packages/server/src/platform/ddd/contracts/|^packages/server/src/platform/ids/",
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
      name: "root-ops-only-from-command-handlers",
      severity: "error",
      comment:
        "ADR-0003: *.root-ops.ts is the aggregate's mutation surface — the one op stereotype that escapes the domain. It may be imported only by the module's own command handlers (commands/*.handler.ts), its own domain/ (invariant guards and sub-op composition), tests, and repository fakes (a test seam). A query, event adapter, interface endpoint, or infrastructure Live reaching for root-ops is bypassing the command boundary — dispatch a command instead, or (for a read predicate) use a *.specification.ts. Cross-module import is already blocked by the barrel rules.",
      from: {
        path: "^packages/server/src/modules/[^/]+/",
        pathNot: [
          "^packages/server/src/modules/[^/]+/domain/",
          "^packages/server/src/modules/[^/]+/commands/[^/]+\\.handler\\.ts$",
          "\\.test\\.ts$",
          "\\.repository-fake\\.ts$",
        ],
      },
      to: { path: "^packages/server/src/modules/[^/]+/domain/.+\\.root-ops\\.ts$" },
    },
    {
      name: "subdomain-isolation",
      severity: "error",
      comment:
        "Within a module's domain, each subdomain folder (domain/<subdomain>/) is a boundary: it may import only its own subdomain (plus effect, platform/ddd/contracts, and platform/ids per domain-isolation). It may NOT import another subdomain, domain/domain-services/, or domain/ports/. Cross-subdomain composition is the job of a domain service in domain/domain-services/ — the one domain location allowed to reach into more than one subdomain (excluded from this rule's `from`). Test files excluded.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/domain/([^/]+)/",
        pathNot: [
          "^packages/server/src/modules/[^/]+/domain/(domain-services|ports)/",
          "\\.test\\.ts$",
        ],
      },
      to: {
        path: "^packages/server/src/modules/[^/]+/domain/[^/]+/",
        pathNot: "^packages/server/src/modules/$1/domain/$2/",
      },
    },
    {
      name: "constituent-ops-domain-private",
      severity: "error",
      comment:
        "ADR-0003: *.entity-ops.ts / *.aggregate-ops.ts / *.value-object-ops.ts encode invariants on an aggregate's internals. They are domain-private — only the module's own domain/ may compose them (hierarchically: root-ops → entity-ops → … → value-object-ops), and nothing outside domain/ may touch them. Mutate the aggregate only through its root: a command, query, adapter, or infrastructure file reaching for a constituent op is bypassing the root. `no-circular` backstops a backwards containment edge.",
      from: {
        path: "^packages/server/src/modules/[^/]+/",
        pathNot: ["^packages/server/src/modules/[^/]+/domain/", "\\.test\\.ts$"],
      },
      to: {
        path: "^packages/server/src/modules/[^/]+/domain/.+\\.(entity-ops|aggregate-ops|value-object-ops)\\.ts$",
      },
    },
    {
      name: "commands-isolation",
      severity: "error",
      comment:
        "Module commands (write-side use cases) may only import: own module's domain and sibling commands, `@effect-server-utils/cqrs` (the message vocabulary a command is declared in — ADR-0006), `@effect-server-utils/unit-of-work` (`withUnitOfWork`, `PersistenceUnavailable`), the DDD shared kernel ports under platform/ddd/ (CommandBus, QueryBus, DomainEventBus, DomainEvent, SpanAttributesExtractor), platform/ids/, and platform/notifications/ port files (e.g. Mailer Tag — same shape as platform/ddd/, just a different infrastructure surface). No platform/*-live.ts (Lives are wired at the composition root), no infrastructure, no interface, no queries, no event-handlers, no @org/contracts (a command's failure channel names domain errors; the endpoint maps them to wire errors — ADR-0004), no @org/database, and (ADR-0022) no other modules' barrels — cross-module calls go through a `domain/ports/acl/` port whose adapter lives in `infrastructure/acl/`. Test files excluded.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/commands/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/(domain|commands)/",
          "^packages/server/src/platform/ddd/",
          "^packages/server/src/platform/ids/",
          "^packages/server/src/platform/notifications/(?!.*-live\\.ts$)",
        ],
      },
    },
    {
      name: "commands-no-external-beyond-effect",
      severity: "error",
      comment:
        "Commands are runtime-pure: only 'effect', the CQRS library and the unit-of-work library allowed externally. No drivers, no clients, no framework code. `@effect-server-utils/cqrs` is the message vocabulary a command is declared in (ADR-0006) and `@effect-server-utils/unit-of-work` is the boundary it declares at its end (ADR-0007); since they are installed dependencies rather than workspace packages, this rule — not `commands-isolation`, whose `to.path` only sees `packages/` — is what admits them.",
      from: {
        path: "^packages/server/src/modules/[^/]+/commands/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/(effect|@effect-server-utils/(cqrs|unit-of-work))/",
      },
    },
    {
      name: "queries-isolation",
      severity: "error",
      comment:
        "Module queries are read-side projections and must NOT reach the write-side consistency boundary: they build their own read models by reading SQL directly via @org/database, never by loading aggregates through repositories. A query may import: sibling queries, `@effect-server-utils/cqrs` (the message vocabulary a query is declared in — ADR-0006), the DDD shared kernel ports under platform/ddd/, platform/ids/, platform/translate-database-errors.ts (the persistence-error translation at the read boundary — a pure leaf whose own imports are @effect-server-utils/cqrs + @org/database types, so it grants a query no reach it does not already have), @org/database, and — from its OWN domain — only two things that are not the write model: branded IDs (domain/<sub>/*.id.ts, identity vocabulary) and cross-context ACL ports (domain/ports/acl/, read facades over OTHER modules; ADR-0020 bans cross-schema SQL so there is no SQL alternative). Everything else in domain is off-limits: roots, *.root-ops.ts, repositories, specifications, value-objects, entities, domain-services, errors, events, and the repository/client ports. May NOT import platform/*-live.ts, own commands, event-handlers, infrastructure, interface, @org/contracts (wire types belong in interface), or (ADR-0022) other modules' barrels. Test files excluded (they may seed via the live repository). See ADR-0002.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/queries/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/queries/",
          "^packages/server/src/modules/$1/domain/[^/]+/[^/]+\\.id\\.ts$",
          "^packages/server/src/modules/$1/domain/ports/acl/",
          "^packages/server/src/platform/ddd/",
          "^packages/server/src/platform/ids/",
          "^packages/server/src/platform/translate-database-errors\\.ts$",
          "^packages/database/",
        ],
      },
    },
    {
      name: "queries-no-external-beyond-effect-and-database",
      severity: "error",
      comment:
        "Queries may use 'effect', the workspace database package, the CQRS library they declare their message in, and the unit-of-work library that owns the `PersistenceUnavailable` their error channel names. No other npm drivers/clients/frameworks. Same note as the commands rule: now that both libraries are installed rather than workspace packages, this rule is what admits them.",
      from: {
        path: "^packages/server/src/modules/[^/]+/queries/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/(effect|@org/database|@effect-server-utils/(cqrs|unit-of-work))/",
      },
    },
    {
      name: "policies-isolation",
      severity: "error",
      comment:
        "A module's `policies/` ring answers 'may this caller do this?' and must never reach the write-side consistency boundary to do it. It may import: sibling policy files, its OWN `queries/` (the read models its checks and resolvers ask), its own `domain/ports/acl/` + the `infrastructure/acl/` adapters its contribution layer provides, its own branded IDs (`domain/<sub>/*.id.ts`), `@effect-server-utils/authz` (the check/resolver vocabulary it registers against), `@effect-server-utils/cqrs` (the QueryBus it dispatches through), `@effect-server-utils/unit-of-work` (PersistenceUnavailable), `platform/ddd/`, `platform/ids/`, `@org/database` (to capture Database for a bus dispatch), and `@org/contracts` (CurrentUser + the Forbidden/NotFound wire errors authz lifts to). Everything else in `domain/` is off-limits: roots, *.root-ops.ts, repositories, specifications, value-objects, entities, and domain-services. Also barred: own commands and event-handlers, `interface/`, `platform/*-live.ts`, and (ADR-0022) another module's barrel — a cross-module answer comes from an `acl/` port, not a direct reach. An authorization check reading aggregate state is the violation this rule exists to stop: model the question as a read model instead. Test files excluded. See ADR-0021, ADR-0022.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/policies/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/policies/",
          "^packages/server/src/modules/$1/queries/",
          "^packages/server/src/modules/$1/domain/ports/acl/",
          "^packages/server/src/modules/$1/infrastructure/acl/",
          "^packages/server/src/modules/$1/domain/[^/]+/[^/]+\\.id\\.ts$",
          "^packages/server/src/platform/ddd/",
          "^packages/server/src/platform/ids/",
          "^packages/database/",
          "^packages/contracts/",
        ],
      },
    },
    {
      name: "interface-events-isolation",
      severity: "error",
      comment:
        "ADR-0007: an event adapter (interface/events/*.event-adapter.ts) is a bus-only inbound port — structurally identical to an HTTP endpoint. It subscribes to a domain event and dispatches a command; it must NOT reach the consistency boundary directly. It may import: its own module's domain events/ids (to subscribe), its own commands' *.command.ts definitions (to dispatch), `@effect-server-utils/cqrs` (CommandBus/QueryBus), the DDD kernel ports under platform/ddd/ (the event buses/UnitOfWork), platform/ids/, and (via foreign-barrel-only-from-outbound-adapter) another module's index.ts barrel for cross-module events. No domain/ports/, no domain ops (*.root-ops.ts etc.), no repositories/infrastructure, no command *.handler.ts, no @org/database — the dispatched command owns all of that. Test files excluded.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/interface/events/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/domain/[^/]+/[^/]+\\.(events|id)\\.ts$",
          "^packages/server/src/modules/$1/commands/[^/]+\\.command\\.ts$",
          "^packages/server/src/modules/[^/]+/index\\.ts$",
          "^packages/server/src/platform/ddd/",
          "^packages/server/src/platform/ids/",
        ],
      },
    },
    {
      name: "sagas-isolation",
      severity: "error",
      comment:
        "ADR-0002/ADR-0007: a saga (sagas/*.saga.ts) is a long-running process manager over EVENTUAL events. Like an event adapter it is bus-only — it correlates events and dispatches its own module's commands, and must NOT reach the consistency boundary itself. It may import: its own module's domain events/ids (to declare what it watches), its own commands' *.command.ts definitions (to dispatch), `@effect-server-utils/cqrs` (Saga, CommandBus/QueryBus, the event buses), platform/ids/, and another module's index.ts barrel for cross-module events. No domain/ports/, no domain ops (*.root-ops.ts etc.), no repositories/infrastructure, no command *.handler.ts, no @org/database — the dispatched command owns all of that. A saga runs on its own fiber with no publisher's transaction to inherit, so reaching for a repository here would write outside every unit of work. Test files excluded.",
      from: {
        path: "^packages/server/src/modules/([^/]+)/sagas/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "^packages/",
        pathNot: [
          "^packages/server/src/modules/$1/domain/[^/]+/[^/]+\\.(events|id)\\.ts$",
          "^packages/server/src/modules/$1/commands/[^/]+\\.command\\.ts$",
          "^packages/server/src/modules/$1/sagas/",
          "^packages/server/src/modules/[^/]+/index\\.ts$",
          "^packages/server/src/platform/ids/",
        ],
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
    {
      name: "outbound-ports-private-to-use-cases",
      severity: "error",
      comment:
        "Outbound ports are private to use cases: the repository port in each subdomain folder (domain/<sub>/*.repository.ts) and the clients/acl ports under domain/ports/. See `pathNot` for the allowlist. The common violation is a controller reaching for a port instead of dispatching through the bus.",
      from: {
        path: "^packages/server/src/modules/[^/]+/",
        pathNot: [
          "^packages/server/src/modules/[^/]+/(commands|queries|infrastructure)/",
          "^packages/server/src/modules/[^/]+/domain/",
          "^packages/server/src/modules/[^/]+/[^/]+\\.(command|query)-handlers\\.ts$",
          "\\.test\\.ts$",
        ],
      },
      to: {
        path: [
          "^packages/server/src/modules/[^/]+/domain/ports/",
          "^packages/server/src/modules/[^/]+/domain/[^/]+/[^/]+\\.repository\\.ts$",
        ],
        // ACL ports have a wider legitimate audience (policies too), so they
        // get their own rule below.
        pathNot: "^packages/server/src/modules/[^/]+/domain/ports/acl/",
      },
    },
    {
      name: "acl-ports-private-to-use-cases-and-policies",
      severity: "error",
      comment:
        "ADR-0022 cross-context ACL ports (`domain/ports/acl/`) may be consumed by the module's use cases (commands/queries), its `policies/` authorization checks, its own `infrastructure/acl/` adapters, and its domain — nothing else. Unlike the repository and client ports (see `outbound-ports-private-to-use-cases`), `policies/` IS a legitimate consumer: an authorization check asks another bounded context a question through this module's own narrow port, which is how a policy avoids depending on a platform-level ACL service. An `interface/` endpoint reaching for an ACL port is still bypassing the bus — dispatch a command or query instead. Test files excluded.",
      from: {
        path: "^packages/server/src/modules/[^/]+/",
        pathNot: [
          "^packages/server/src/modules/[^/]+/(commands|queries|infrastructure|policies)/",
          "^packages/server/src/modules/[^/]+/domain/",
          "^packages/server/src/modules/[^/]+/[^/]+\\.(command|query)-handlers\\.ts$",
          "\\.test\\.ts$",
        ],
      },
      to: { path: "^packages/server/src/modules/[^/]+/domain/ports/acl/" },
    },
    {
      name: "rpc-stays-behind-the-cqrs-package",
      severity: "error",
      comment:
        "`@effect-server-utils/cqrs` exists so that the transport carrying commands and queries is an implementation detail. A feature module declares a message with `Command.make` and implements it with `Command.handlersOf`; it must never name the underlying rpc primitives, or the library is a pass-through and the transport can no longer change without touching every module. Now that the library is installed rather than vendored, nothing in this repository has any business naming rpc — if you need something rpc offers that the library does not expose, widen the library's surface in its own repository.",
      from: { path: "^packages/" },
      to: { path: "/node_modules/effect/(dist|src)/unstable/rpc/" },
    },
    {
      name: "lives-only-from-composition-roots",
      severity: "error",
      comment:
        "Live implementations of DDD shared kernel ports (platform/*-live.ts) are wired only by the composition roots (server.ts and cqrs-runtime.ts, the slice of it production and the test runtime share verbatim), the test runtime (test-utils/), and integration tests that intentionally stage a sub-graph. Production-path code — commands, queries, event-handlers, domain, interface, middlewares — depends on the ports under platform/ddd/ and `@effect-server-utils/cqrs`, never on these Lives. Lives may import each other. The command/query bus factories are the same kind of thing but live in `@effect-server-utils/cqrs`, where a path rule cannot reach them through the package barrel; the eslint `no-restricted-imports` entry for `makeCommandBus`/`makeQueryBus`/`mergeDispatchTables` is what keeps those at a composition root.",
      from: {
        path: "^packages/server/src/",
        pathNot: [
          "^packages/server/src/server\\.ts$",
          "^packages/server/src/cqrs-runtime\\.ts$",
          "^packages/server/src/test-utils/",
          ".*\\.test\\.ts$",
          "^packages/server/src/platform/[^/]+-live\\.ts$",
        ],
      },
      to: { path: "^packages/server/src/platform/[^/]+-live\\.ts$" },
    },
    {
      name: "dumb-repository-live-no-app-collaborators",
      severity: "error",
      comment:
        "ADR-0005: repository Lives are dumb persistence. They map an aggregate to/from rows and nothing more — they must not import the command/query use cases, nor the application-tier buses and unit-of-work (CommandBus, QueryBus, DomainEventBus, UnitOfWork — the last now in its own package, so the path list names both). Publishing events, dispatching commands, and owning the transaction boundary are the use case's job, not the repository's. A repository that reaches for these is smuggling business logic into persistence — move it to the aggregate or the use case. (The eslint `dumb-repository-ports` rule guards the port's method names; this guards what the Live collaborates with.)",
      from: {
        path: "^packages/server/src/modules/[^/]+/infrastructure/repositories/[^/]+\\.repository-live\\.ts$",
      },
      to: {
        path: [
          "^packages/server/src/modules/[^/]+/(commands|queries)/",
          "/node_modules/@effect-server-utils/cqrs/dist/[^/]+/(command-bus|query-bus|event-bus)\\.js$",
          "/node_modules/@effect-server-utils/unit-of-work/dist/[^/]+/unit-of-work\\.js$",
          "^packages/server/src/platform/ddd/event-bus\\.ts$",
        ],
      },
    },
    {
      name: "interface-util-files-are-leaves",
      severity: "error",
      comment:
        "ADR-0023: an interface `*.util.ts` is a pure, leaf protocol/wire helper extracted from an endpoint for testability. It must not import ports (`domain/ports/`), use cases (`commands`/`queries`), infrastructure adapters, the application buses/unit-of-work, or a module barrel. Orchestration and domain access belong in the endpoint or a use case, not a util — this keeps the util mechanical and denies it as a backdoor around the architecture. Test files excluded.",
      from: {
        path: "^packages/server/src/modules/[^/]+/interface/[^/]+/[^/]+\\.util\\.ts$",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: [
          "^packages/server/src/modules/[^/]+/domain/ports/",
          "^packages/server/src/modules/[^/]+/(commands|queries|infrastructure)/",
          "/node_modules/@effect-server-utils/cqrs/dist/[^/]+/(command-bus|query-bus|event-bus)\\.js$",
          "/node_modules/@effect-server-utils/unit-of-work/dist/[^/]+/unit-of-work\\.js$",
          "^packages/server/src/platform/ddd/event-bus\\.ts$",
          "^packages/server/src/modules/[^/]+/index\\.ts$",
        ],
      },
    },
    // ── Web rules (ADR-0014, ADR-0015) ─────────────────────────────────
    // View-tiering and component-library guarantees, ported from the
    // pre-Next SPA (`packages/client/src/`) to the Next App Router
    // layout (`packages/web/`, no `src/` wrapper, `app/` framework
    // surface added). Run via the second pass in `lint:deps` against
    // `tsconfig.depcruise-web.json`.
    {
      name: "web-no-tanstack",
      severity: "error",
      comment:
        "TanStack Query and TanStack Form are gone: the frontend state substrate is Effect Atom (ADR-0026). Reads are `ApiAtoms.query`, writes are `ApiAtoms.mutation`, invalidation is a reactivity key, and form state is plain atoms in a ViewModel. If you are reaching for @tanstack/* you are re-introducing the layer this architecture replaced.",
      from: { path: "^packages/web/" },
      to: { path: "/node_modules/@tanstack/" },
    },
    {
      name: "web-view-reaches-only-its-view-model",
      severity: "error",
      comment:
        "MVVM dependency direction (ADR-0026): a View depends on its ViewModel, and a ViewModel depends on the Model. A View may not reach past its ViewModel into `services/` — not the API atoms, not the notification or navigation seams, not the runtime. Everything a View renders or dispatches arrives as an atom its own ViewModel exposes; that is what lets the ViewModel be tested with no renderer and the View with no server. `app/` is framework surface and composes the Model directly (prefetch + hydration boundary), so it is exempt.",
      from: {
        path: "^packages/web/features/.*\\.view\\.tsx$",
        pathNot: "\\.(stories|test|spec)\\.(ts|tsx)$",
      },
      to: { path: "^packages/web/services/" },
    },
    {
      name: "web-view-model-no-view",
      severity: "error",
      comment:
        "MVVM dependency direction (ADR-0026): the arrow points View → ViewModel, never back. A ViewModel that imports a View has made itself untestable without a renderer, which is the whole thing this layering buys.",
      from: { path: "^packages/web/features/.*\\.view-model\\.ts$" },
      to: { path: "^packages/web/features/.*\\.view\\.tsx$" },
    },
    {
      name: "web-model-no-features",
      severity: "error",
      comment:
        "MVVM dependency direction (ADR-0026): the Model (`services/`) is the innermost tier and knows nothing about the features that read it. A `services/` file importing from `features/` inverts the arrow and couples the API surface to a screen.",
      from: {
        path: "^packages/web/services/",
        pathNot: "\\.(stories|test|spec)\\.(ts|tsx)$",
      },
      to: { path: "^packages/web/features/" },
    },
    {
      name: "web-view-no-effect-runtime",
      severity: "error",
      comment:
        "Views (*.view.tsx) may not import Effect runtime primitives. Reaching for Effect/Stream/Fiber/Ref/SubscriptionRef/Layer/Scope/Runtime/ManagedRuntime/Cause/Exit/Match means the logic belongs in the ViewModel (*.view-model.ts). Allowed effect modules in a View: Schema, Function, Result, Option, Predicate, Duration, Array, and the reactivity types it renders (AsyncResult). App Router files (app/) are framework-coupled and exempt. See ADR-0026.",
      from: {
        path: "^packages/web/features/.*\\.view\\.tsx$",
        pathNot: "\\.(stories|test|spec)\\.(ts|tsx)$",
      },
      to: {
        path: "/node_modules/effect/.*/(Effect|Stream|Fiber|Ref|SubscriptionRef|Layer|Scope|Runtime|ManagedRuntime|Cause|Exit|Match)\\.",
      },
    },
    {
      name: "web-ui-libs-only-in-components",
      severity: "error",
      comment:
        "Third-party visual libraries (@radix-ui/*, lucide-react, recharts, sonner) live with the bespoke component library in @org/components. Web code may not import them directly — consume the wrapped primitive instead, and widen the primitive when it cannot express what you need. Test files exempted. See ADR-0015.",
      from: {
        path: "^packages/web/",
        pathNot: "\\.(stories|test|spec)\\.(ts|tsx)$",
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
        "ViewModels (*.view-model.ts) are framework-agnostic: they run under a bare `AtomRegistry` in a test with no renderer anywhere. They may not import react, react-dom, the atom React bindings (@effect/atom-react), or any other React-coupled package. A ViewModel that needs a hook is a View that has been misfiled. See ADR-0026.",
      from: {
        path: "^packages/web/features/.*\\.view-model\\.ts$",
        pathNot: "\\.(stories|test|spec)\\.(ts|tsx)$",
      },
      to: {
        path: "/node_modules/(react|react-dom|@effect/atom-react|@tanstack/|react-hook-form)",
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
        "Routes under packages/web/app/ compose features; features must not import app/ pages, layouts, or providers. The dependency direction is app → features, never reversed. Server-only or shared infra files in app/ are not feature dependencies — promote them to /services first.",
      from: { path: "^packages/web/features/" },
      to: { path: "^packages/web/app/" },
    },
    {
      name: "platform-ids-effect-only",
      severity: "error",
      comment:
        "platform/ids/ is the minimal shared kernel for cross-module branded entity " +
        "IDs (ADR-0002). It may only depend on `effect` from third-party packages. " +
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
