# Project conventions

Effect monorepo, hexagonal architecture, DDD. Full rationale in `docs/adr/`. The bullets below are the high-leverage conventions an LLM contributor needs in working memory.

## Module layout

Each feature module lives at `packages/server/src/modules/<feature>/` with sibling folders. There is no `application/` umbrella — commands, queries, and event-handlers are siblings, each with its own dependency-cruiser isolation rule (see ADR-0008).

- `domain/` — events, errors, ports (see `domain/ports/` below), and the DDD stereotypes below. Each stereotype carries an explicit filename suffix and a matching identifier-keyword suffix so its role is legible at a glance:
  - **Aggregate roots** — `*.root.ts`. The root data type is `XRoot` (a `Schema.Class`). Operations are **pure free functions** collected into an `export const XRootOps = { … } as const` bag — the data stays a dumb value (no methods/statics on it). Consumers `import { XRoot, XRootOps }` — there is no `import * as`. Only `*.root.ts` carries a test-parity obligation. Lifecycle default: carry state in flag/nullable columns and let each op guard its own invariants and return `Either<Result, DomainError>` (so invariants are enforced in the domain once); model states as distinct variant classes unioned into `XRoot` only when states carry divergent data or a large transition matrix warrants it — see ADR-0003.
  - **Constituent aggregates** — `*.aggregate.ts` (a collection of entities/VOs that is only a _part_ of a root, not itself a consistency-boundary root). No parity obligation.
  - **Entities** — `*.entity.ts`, identifier `XEntity`.
  - **Value objects** — `*.value-object.ts`, identifier `XValueObject` (attribute-bag, no identity of its own).
  - **Branded IDs** — `*.id.ts`, identifier `XId`. An identifier is technically a value object, but it gets its own category: it already carries its keyword (`Id`) and denotes an entity's identity rather than being an attribute-bag.
  - **Errors / events** — `*.errors.ts`, `*.events.ts`.
  - **Filename convention (ADR-0027):** every stereotype is a dot-delimited suffix (`.command`, `.repository`, `.handler`, …); dashes appear only _within_ a concept name (`api-token.repository.ts`, `find-users.query.ts`). Compound stereotypes keep internal dashes as one segment (`.repository-live`, `.event-adapter`, `.value-object`).
  - **Domain services** — `*.domain-service.ts`, a pure free-function bag (like `RootOps`, no DI Tag) for stateless domain logic **no single aggregate owns** (ADR-0026). Test-obligated. Guard against anemia: only for logic with no aggregate home (e.g. `CredentialHash`, applied to raw lookup input across aggregates); logic that operates on one aggregate stays on its `RootOps`. Randomness never lives here — it's impure, so it stays in the command (the shell).
  - **Ports** — `domain/ports/`, tiered by counterpart (ADR-0023, ADR-0025); no port sits directly in `ports/`. `ports/repositories/*.repository.ts` (own datastore), `ports/clients/*.client.ts` (true third-party systems), `ports/acl/*.acl.ts` (other bounded contexts). The tier decides the anti-corruption obligation and, for `acl/`, which infrastructure adapter may import a foreign barrel.
- `commands/` — write-side use cases. Each has a `<verb-noun>.command.ts` schema (registry-merges into `CommandRegistry`) plus a `<verb-noun>.handler.ts` handler.
- `queries/` — read-side projections. Same `.query.ts` schema + `.handler.ts` handler split. May import `@org/database` directly and bypass the domain — there's no aggregate to protect when nothing mutates.
- `event-handlers/` — write-side use cases (`*.handler.ts`) reacting to internal triggers (`event-handlers/triggers/<publisher>.triggers.ts`). Run in the publisher's fiber and inherit its transaction (ADR-0007). Same dependency shape as `commands/` — no cross-module barrel imports.
- `infrastructure/` — driven adapters, tiered by counterpart to mirror `domain/ports/` (ADR-0025); private to the module. `infrastructure/repositories/` (`*.repository-live.ts` + `*.repository-fake.ts` + `*.mapper.ts`), `infrastructure/clients/` (third-party adapters: `*.client-live.ts` + `*.client-fake.ts` behind a `*.client.ts` port, self-contained `*.client.ts` clients, `*.email.tsx` templates), `infrastructure/acl/` (anti-corruption adapters to other modules: `*.acl-live.ts` + `*.acl-fake.ts` behind a `*.acl.ts` port — the only place, besides `interface/events/`, permitted to import a foreign barrel).
- `interface/` — inbound adapters, one subfolder per protocol:
  - `interface/http/` — one `<endpoint-name>.endpoint.ts` per HTTP endpoint (ADR-0013), plus an `index.ts` barrel that registers the endpoint groups. May also hold `*.util.ts` — pure, leaf, test-obligated protocol/wire helpers shared between endpoints (ADR-0026). `*.util.ts` is allowed **only** in `interface/http/` and `interface/cli/` — never in the application layer (commands/queries/event-handlers), where a shared helper is a smell (it's domain logic → an aggregate op, or trivial → inline). A leaf rule bars utils from importing ports, use cases, infrastructure, buses, or barrels.
  - `interface/events/` — one `<publisher>.event-adapter.ts` per upstream module whose domain events this module consumes (ADR-0007 ACL). The only place in the consumer module permitted to import another module's barrel.
- `policies/` — `*.policies.ts` registry, `*.resource-resolver(s).ts`, and `is-*.policy.ts` checks. `policies/public/` holds `*.service-live.ts` — this module's Live implementations of platform ACL service ports (e.g. `RoleServiceLive`), published to the centralized policy registry and wired at the composition root.
- **Module root** — a closed set of aggregation/composition files only (ADR-0027): `index.ts` (barrel), `<feature>.module.ts` (composed Layer), `<feature>.command-handlers.ts` / `<feature>.query-handlers.ts` (bus-registration maps), `<feature>.event-span-attributes.ts`, `<feature>.shared-deps.ts`. Any other file must move into a subfolder — enforced by the `project-structure/folder-structure` ESLint rule (see below).

Cross-module access goes through the module's `index.ts` barrel, which may not re-export from `infrastructure/` or `interface/`. The published surface is domain types (events, IDs, errors), command/query messages, handler-registration maps, and the module's `Live` layer.

## File taxonomy: layout + test parity (enforced by `pnpm lint`)

The file taxonomy — layout (which file kinds a folder admits), sibling parity
(required tests/fakes/stories), and subfolder allowlists — is one declarative
config, `eslint.project-structure.mjs`, enforced by the
`project-structure/folder-structure` ESLint rule under `pnpm lint` (in-editor + CI).
It replaced the bespoke `check-folder-layout.mjs` / `check-test-parity.mjs`
scripts (ADR-0028). Each rule carries a didactic `message` telling you _what to
do_, not just that a file is misplaced. To add a genuinely new file kind or
stereotype, declare it in `eslint.project-structure.mjs` — deliberately, not by
working around the check.

**Parity.** If you create any of these without its sibling, `pnpm lint` fails:

| When you create…                            | Write a sibling…                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `domain/*.root.ts`                          | `domain/<base>.root.test.ts` (aggregate roots; the non-root domain stereotypes need none)                   |
| `domain/*.domain-service.ts`                | `domain/<base>.domain-service.test.ts` (domain services carry a test — they're real domain logic)           |
| `commands/*.handler.ts`                     | `commands/<base>.handler.test.ts` (the test sits on the handler)                                            |
| `queries/*.handler.ts`                      | `queries/<base>.handler.integration.test.ts` (queries read real SQL — the parity is the integration test)   |
| `event-handlers/*.handler.ts`               | `event-handlers/<base>.handler.test.ts`                                                                     |
| `interface/{http,cli}/*.endpoint.ts`        | `<base>.endpoint.integration.test.ts` (login/logout OIDC endpoints are exempted — see Endpoint test naming) |
| `interface/{http,cli}/*.util.ts`            | `<base>.util.test.ts` (the test obligation is the anti-drift guard — ADR-0026)                              |
| `interface/events/*.event-adapter.ts`       | `interface/events/<base>.event-adapter.test.ts`                                                             |
| `domain/ports/repositories/*.repository.ts` | in `infrastructure/repositories/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.integration.test.ts`  |
| `domain/ports/clients/*.client.ts`          | in `infrastructure/clients/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.test.ts`                   |
| `domain/ports/acl/*.acl.ts`                 | in `infrastructure/acl/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.test.ts`                       |

Adapter parity is anchored on the **port** (not the adapter), so a repository/client/acl
port and its adapters must share a base name (a self-contained `infrastructure/clients/*.client.ts`
with no port is not required to have a live/fake). The naming conventions are the
parity detectors — don't rename a file to dodge the rule, write the test.

**Layout.** Each stereotype folder admits a closed set of file kinds (ADR-0025);
an unrecognized source file fails. This is the inverse of parity: parity asks
whether a required sibling exists, layout asks whether a file is allowed to exist
at all. It stops convention drift — the stray `session-utils.ts` in `domain/` or
`todo-helpers.ts` in `commands/` that should have been an aggregate op or a named
stereotype. **Container folders** (`domain/ports/`, `infrastructure/`,
`interface/`) admit no direct files — content lives in a tier subfolder. Subfolders
are allowlisted too: a module admits only `domain/ commands/ queries/
event-handlers/ infrastructure/ interface/ policies/`, so a stray
`modules/x/helpers/` or `interface/grpc/` fails like a stray file.

**Concessions** (ADR-0028): the old commands/queries "pair rule" (a `<base>.ts`
handler admitted only if its schema sibling exists) is dropped — deny-by-default
still blocks stray-named files, and an orphan handler still owes its test. A
completely empty stray folder (no linted files) is not visited by the rule, so it
escapes — low risk.

## Test seams

- **Use-case unit tests** (`commands/`, `event-handlers/`) compose three test-only services: `UserRepositoryFake`, `RecordingEventBus`, `IdentityUnitOfWork`. No DB, no docker.
- **Two disjoint suites, selected by file suffix + the `TEST_INTEGRATION` env toggle** (in `vitest.shared.ts`). `pnpm test` runs the **unit** suite — every `*.test.ts` _except_ `*.integration.test.ts` — and needs no auxiliary services. `pnpm test:integration` (sets `TEST_INTEGRATION=true`, scoped to `@org/server` + `@org/jobs`) runs **only** `*.integration.test.ts`. The suites never overlap.
- **Integration tests** (`*.repository-live.integration.test.ts`, `<endpoint>.endpoint.integration.test.ts`, `<query>.handler.integration.test.ts`) hit a real DB and are **dumb** — they do not self-skip. The integration global-setup hard-fails (asserts `DATABASE_URL_TEST` is set, then connects) so a missing or unreachable DB aborts the whole run rather than silently skipping. Provide `DATABASE_URL_TEST` (name must contain `test`) before running `pnpm test:integration`.
- **HTTP integration tests** use `useServerTestRuntime(["table1", "table2"])` from `test-utils/`, which wires `ManagedRuntime.make(TestServerLive)` + `beforeAll`/`afterAll` + per-test `truncate`. Tests then exercise the contract via `HttpApiClient.make(Api)` and seed prior state by calling _other endpoints_, not by reaching into module internals.
- **Query/repository integration tests** seed via the live repository (or other production-path code), not via raw SQL. Using the repository as the seeding seam keeps the test honest about what production paths look like.
- **Endpoint test naming.** A test file ending in `*.endpoint.integration.test.ts` exercises the real HTTP layer against a live database via `useServerTestRuntime(...)`. A file ending in `*.endpoint.test.ts` is a true unit test — no DB, no HTTP round-trip — typically a parity-rule token for endpoints whose meaningful coverage lives elsewhere (the OIDC `login` / `logout` flows, covered by Playwright + `SessionRepositoryLive` integration tests; `callback`'s reachable no-IdP guard has a real `callback.endpoint.integration.test.ts`). The `login`/`logout` endpoints are the two named exemptions in the folder-structure rule; every other endpoint must have `*.endpoint.integration.test.ts`. Any `.endpoint.test.ts` file must carry a header comment naming where the meaningful coverage lives; if a test starts hitting real HTTP + DB, rename it to `.endpoint.integration.test.ts`.

## Commands

| Command                                                | What it runs                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm check:all`                                       | lint + lint:deps + typecheck + tests (the full gate)                                            |
| `pnpm lint`                                            | ESLint — includes the `project-structure/folder-structure` file-taxonomy rule (layout + parity) |
| `pnpm test`                                            | vitest **unit** suite (excludes `*.integration.test.ts`), no DB                                 |
| `DATABASE_URL_TEST=postgres://… pnpm test:integration` | **integration** suite only (`*.integration.test.ts`); hard-fails if no DB                       |
| `pnpm lint:deps`                                       | dependency-cruiser architecture rules                                                           |

## Conventions worth knowing

- **Errors as `Schema.TaggedError`** (ADR-0004). Domain errors live in `domain/`, contract errors live in the contracts package, and the HTTP endpoint maps domain → contract via `Effect.catchTag`.
- **Typed bus** (ADR-0006). `bus.execute(SomeCommand.make({...}))` returns the exact `Effect<A, E, R>` declared in the registry. No casts, no `Result` unwrapping.
- **Unit-of-work boundary + two buses** (ADR-0007). Command handlers declare the transaction once at the boundary with `.pipe(withUnitOfWork)` (not an inner `uow.run` block); it demotes `DatabaseError` to a defect and surfaces `PersistenceUnavailable`. `UnitOfWork.run` is the low-level escape hatch (integration tests, sub-blocks that keep external IO outside the tx). Nested runs open a real **savepoint**: a caught nested failure rolls back only the savepoint while the outer commits. Two domain-event buses share one `DomainEvent` base — the bus you publish to is the switch: **`DomainEventBus`** (immediate; subscribers run in the publisher's fiber/transaction, a failure rolls the publisher back) vs **`IntegrationEventBus`** (eventual; `dispatch` buffers, the outermost `run` flushes after commit, each handler in its own transaction with failures logged/isolated). Default new cross-aggregate reactions to the integration bus. Dispatching to either bus outside a unit of work is a defect (fail-fast on a forgotten `withUnitOfWork`). In-memory flush for now (lossy on commit-then-crash); transactional outbox is the deferred durability follow-up.
- **Ports vs Lives** (ADR-0007). The DDD shared kernel lives in `platform/ddd/` as ports, tiered into two folders (ADR-0008): `platform/ddd/contracts/` holds the domain-safe _types/contracts_ (`DomainEvent`, `SpanAttributesExtractor`, `PersistenceUnavailable`, `PostCommitBuffer`) the domain may reference; `platform/ddd/ports/` holds the application-tier _services_ (`UnitOfWork`, `CommandBus`, `QueryBus`, `DomainEventBus`, `IntegrationEventBus`, the ACL services) plus factory helpers like `commandHandlers`/`eventSpanAttributes` and the `withUnitOfWork` combinator. The rule: domain may depend on contracts, never on ports. Production implementations live in sibling `platform/*-live.ts` files (`UnitOfWorkLive`, `makeCommandBus`, `makeQueryBus`, `makeDomainEventBusLive`, `makeIntegrationEventBusLive`). Use cases, interface, and middlewares depend on `platform/ddd/` only; Lives are wired at the composition root (`server.ts`, `test-utils/test-server.ts`) and in integration tests that intentionally stage a sub-graph. Enforced by `lives-only-from-composition-roots`; the contracts/ports tiering is enforced by `domain-isolation` + `ddd-contracts-no-ports`.
- **Bus-boundary spans** (ADR-0012). Spans live at the command/query/event bus and at HTTP endpoints; use cases don't need their own `Effect.withSpan`. Span attributes are sibling extractor functions composed at registration.
- **Authentication via self-hosted Zitadel as a server-side BFF** (ADR-0016, ADR-0017). The SPA never holds access or id tokens; the server runs the OIDC dance and issues a `HttpOnly` session cookie. Application code consumes `CurrentUser` (`@org/contracts/Policy`); only `modules/auth/` and `platform/auth/` know about Zitadel. Roles live app-side in `users.role`; the seed script pre-seeds the admin's `users` + `auth_identities` rows so the first sign-in finds an existing identity.
- **Per-module DB schemas** (ADR-0021). Each module owns a Postgres schema named after its folder: `user`, `todos`, `wallet`, `auth`. Application SQL must address tables by their owning schema — `"user".users`, `todos.todos`, `wallet.wallets`, `auth.auth_identities`, `auth.sessions`. The `"user"` quotes are required (Postgres reserved word). Cross-schema FKs are allowed at DDL only (`wallet.wallets.user_id → user.users.id`, both `auth.*.user_id → user.users.id`); application SQL must never JOIN, SELECT, INSERT, UPDATE, or DELETE across schemas. Cross-module reads continue to flow through the synchronous event bus + interface/events ACL. Enforced by `@synapsestudios/data-boundaries/no-cross-schema-slonik-access` in `eslint.config.mjs` (scoped to `packages/server/src/modules/**`, excluding test files). Adding a module: write a `Vxxx__create_schema_<name>.sql` migration and add `<name>` to `MODULE_SCHEMAS` in all three test-database files (`packages/server/src/test-utils/test-database.ts`, `packages/jobs/src/test-utils/test-database.ts`, `packages/acceptance/test-utils/database.ts`).

## Frontend (`packages/web/`)

The frontend is a Next.js (App Router) renderer that proxies `/api/*` to the Effect server. The Effect server stays the BFF — Next renders + proxies but does NOT terminate auth. See [ADR-0018](docs/adr/0018-frontend-nextjs-renderer-and-proxy.md).

**Layout** (no `src/` wrapper):

- `app/` — Next file-based routes. `(authed)/` is the route group for protected pages (server-side guard in `(authed)/layout.tsx` calls `/auth/me`, `redirect()`s on 401). `app/providers.tsx` wires `ThemeProvider → QueryClientProvider → RuntimeProvider → Toaster`.
- `features/` — feature-shaped components and presenters (no `src/` wrapper).
- Bespoke component library lives in a sibling workspace package — `@org/components` (`packages/components/`). Web imports primitives via `@org/components/primitives/<name>`. Storybook is hosted there too. Same primitives → patterns → features direction as before; the only thing that changed is the package boundary.
- `services/` — runtime, ApiClient, data-access. Files split by environment when behavior differs:
  - `*.shared.ts` — environment-agnostic (e.g. the shared `ApiClient` `Context.Tag`).
  - `*.server.ts` — server-only (`import "server-only"`; reads cookies via `next/headers`).
  - `*.client.tsx` — browser-only (`"use client"`; mounts via `RuntimeProvider`).
  - `data-access/<feature>-queries.ts` — server-safe Effects (no `"use client"` so server components can prefetch).
  - `data-access/use-<feature>-queries.ts` — client hooks wrapping the Effects in `useEffectSuspenseQuery`/`useEffectMutation`.
- `lib/tanstack-query/` — `prefetchEffectQuery` (server), `useEffectSuspenseQuery` and `useEffectMutation` (client), `make-form-options.ts`, `query-data-helpers.ts`.
- `instrumentation.ts` — Node OTEL bootstrap via `@vercel/otel` (Phase 5 of the migration). Browser OTEL ports later as a follow-up.

**Data fetching default** (ADR-0018): each route's `page.tsx` runs `prefetchEffectQuery` server-side, dehydrates the cache into `<HydrationBoundary>`, and the leaf component reads via `useEffectSuspenseQuery`. Plain `useQuery` is allowed only for client-only side data (search-as-you-type, polling). Mutations stay client-side via `useEffectMutation`.

**View tiering** (ADR-0014): naked component → `*.presenter.{ts,tsx}` (React-coupled libraries: TanStack Form, react-hook-form, etc.) → `*.view-model.ts` (pure Effect, framework-agnostic). Components in `features/` may not import Effect runtime primitives or `@tanstack/react-query` directly. Enforced by the `web-*` rules in `.dependency-cruiser.cjs` (web pass) and the ViewModel/Presenter parity rules in the `project-structure/folder-structure` config (`eslint.project-structure.mjs`, `webFeatures`). Presenter tests standardize on `.presenter.test.tsx`.

**Component library** (`packages/components/`, ADR-0015). Two trees: `primitives/` (atoms) and `patterns/` (molecules + organisms). Dependency direction: `features (web) → patterns → primitives → third-party`. Only `primitives/` may import `@radix-ui/*`, `lucide-react`, `recharts`, or `sonner`. New icons: add a one-line `createIcon` wrapper to `primitives/icon/icons.ts`; never import `lucide-react` from outside `primitives/`. Every primitive and pattern needs a sibling `*.stories.tsx` (enforced by the `project-structure/folder-structure` rule — `eslint.project-structure.mjs`, `componentsPrimitives`/`componentsPatterns`). Storybook runs via `pnpm -F @org/components storybook`; a static build is part of `check:all`.

**Run locally**:

```bash
pnpm bootstrap                    # Docker (postgres, jaeger, zitadel) + migrate + seed
pnpm --filter @org/server dev     # BFF on :3001
pnpm --filter @org/web dev        # Next.js on :3000 (browser-facing); /api/* rewrites to :3001
```
