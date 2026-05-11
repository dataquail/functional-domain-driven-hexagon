# Project conventions

Effect monorepo, hexagonal architecture, DDD. Full rationale in `docs/adr/`. The bullets below are the high-leverage conventions an LLM contributor needs in working memory.

## Module layout

Each feature module lives at `packages/server/src/modules/<feature>/` with sibling folders. There is no `application/` umbrella — commands, queries, and event-handlers are siblings, each with its own dependency-cruiser isolation rule (see ADR-0008).

- `domain/` — entities, value objects, events, errors, IDs, repository ports. Aggregate roots are named `*.aggregate.ts` as an explicit DDD signal.
- `commands/` — write-side use cases. Each has a `<verb-noun>-command.ts` schema (registry-merges into `CommandRegistry`) plus a `<verb-noun>.ts` handler.
- `queries/` — read-side projections. Same `-query.ts` schema + `<base>.ts` handler split. May import `@org/database` directly and bypass the domain — there's no aggregate to protect when nothing mutates.
- `event-handlers/` — write-side reactions to domain events. Run in the publisher's fiber and inherit its transaction (ADR-0007).
- `infrastructure/` — repository `Live` + `Fake` implementations, mappers. Private to the module.
- `interface/` — one `<endpoint-name>.endpoint.ts` per HTTP endpoint (ADR-0013), plus a thin `<feature>-http-live.ts` group registration.

Cross-module access goes through the module's `index.ts` barrel, which may not re-export from `infrastructure/` or `interface/`. The published surface is domain types (events, IDs, errors), command/query messages, handler-registration maps, and the module's `Live` layer.

## Test parity (enforced by `pnpm lint:tests`)

If you create any of these without a sibling test, CI fails:

| When you create…                      | Write a sibling…                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `domain/*.aggregate.ts`               | `domain/<base>.aggregate.test.ts`                                                                         |
| `commands/*-command.ts`               | `commands/<base>.test.ts` (drop the `-command` suffix)                                                    |
| `queries/*-query.ts`                  | `queries/<base>.integration.test.ts` (or `.test.ts`)                                                      |
| `event-handlers/*.ts`                 | `event-handlers/<base>.integration.test.ts` (or `.test.ts`)                                               |
| `interface/*.endpoint.ts`             | `interface/<base>.endpoint.integration.test.ts`                                                           |
| `infrastructure/*-repository-live.ts` | `infrastructure/<base>-repository-live.integration.test.ts` AND a `<base>-repository-fake.ts` counterpart |

The naming conventions are also the parity-rule detectors. Don't rename a file to dodge the rule — write the test.

## Test seams

- **Use-case unit tests** (`commands/`, `event-handlers/`) compose three test-only services: `UserRepositoryFake`, `RecordingEventBus`, `IdentityTransactionRunner`. No DB, no docker.
- **Integration tests** (`*-repository-live.integration.test.ts`, `<endpoint>.endpoint.integration.test.ts`, `<query>.integration.test.ts`) hit a real DB. They self-skip when `DATABASE_URL_TEST` is unset; `pnpm test` succeeds with no auxiliary services.
- **HTTP integration tests** use `useServerTestRuntime(["table1", "table2"])` from `test-utils/`, which wires `ManagedRuntime.make(TestServerLive)` + `beforeAll`/`afterAll` + per-test `truncate`. Tests then exercise the contract via `HttpApiClient.make(Api)` and seed prior state by calling _other endpoints_, not by reaching into module internals.
- **Query/repository integration tests** seed via the live repository (or other production-path code), not via raw SQL. Using the repository as the seeding seam keeps the test honest about what production paths look like.
- **Endpoint test naming.** A test file ending in `*.endpoint.integration.test.ts` exercises the real HTTP layer against a live database via `useServerTestRuntime(...)`. A file ending in `*.endpoint.test.ts` is a true unit test — no DB, no HTTP round-trip — typically a parity-rule token for endpoints whose meaningful coverage lives elsewhere (e.g. the OIDC `login` / `callback` / `logout` flows, covered by Playwright + `SessionRepositoryLive` integration tests). Any `.endpoint.test.ts` file must carry a header comment naming where the meaningful coverage lives; if a test starts hitting real HTTP + DB, rename it to `.endpoint.integration.test.ts`.

## Commands

| Command                                    | What it runs                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `pnpm check:all`                           | lint + lint:deps + lint:tests + typecheck + tests (the full gate) |
| `pnpm test`                                | vitest, no DB                                                     |
| `DATABASE_URL_TEST=postgres://… pnpm test` | also runs integration tests                                       |
| `pnpm lint:deps`                           | dependency-cruiser architecture rules                             |
| `pnpm lint:tests`                          | test-parity check                                                 |

## Conventions worth knowing

- **Errors as `Schema.TaggedError`** (ADR-0004). Domain errors live in `domain/`, contract errors live in the contracts package, and the HTTP endpoint maps domain → contract via `Effect.catchTag`.
- **Typed bus** (ADR-0006). `bus.execute(SomeCommand.make({...}))` returns the exact `Effect<A, E, R>` declared in the registry. No casts, no `Result` unwrapping.
- **Synchronous event bus** (ADR-0007). Subscribers run in the publisher's fiber and inherit `TransactionContext`. A subscriber's failure rolls back the publisher's transaction.
- **Bus-boundary spans** (ADR-0012). Spans live at the command/query/event bus and at HTTP endpoints; use cases don't need their own `Effect.withSpan`. Span attributes are sibling extractor functions composed at registration.
- **Authentication via self-hosted Zitadel as a server-side BFF** (ADR-0016, ADR-0017). The SPA never holds access or id tokens; the server runs the OIDC dance and issues a `HttpOnly` session cookie. Application code consumes `CurrentUser` (`@org/contracts/Policy`); only `modules/auth/` and `platform/auth/` know about Zitadel. Roles live app-side in `users.role`; the seed script pre-seeds the admin's `users` + `auth_identities` rows so the first sign-in finds an existing identity.

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

**View tiering** (ADR-0014): naked component → `*.presenter.{ts,tsx}` (React-coupled libraries: TanStack Form, react-hook-form, etc.) → `*.view-model.ts` (pure Effect, framework-agnostic). Components in `features/` may not import Effect runtime primitives or `@tanstack/react-query` directly. Enforced by the `web-*` rules in `.dependency-cruiser.cjs` (web pass) and the ViewModel/Presenter parity rules in `scripts/check-test-parity.mjs`.

**Component library** (`packages/components/`, ADR-0015). Two trees: `primitives/` (atoms) and `patterns/` (molecules + organisms). Dependency direction: `features (web) → patterns → primitives → third-party`. Only `primitives/` may import `@radix-ui/*`, `lucide-react`, `recharts`, or `sonner`. New icons: add a one-line `createIcon` wrapper to `primitives/icon/icons.ts`; never import `lucide-react` from outside `primitives/`. Every primitive and pattern needs a sibling `*.stories.tsx` (enforced by `lint:tests`). Storybook runs via `pnpm -F @org/components storybook`; a static build is part of `check:all`.

**Run locally**:

```bash
pnpm bootstrap                    # Docker (postgres, jaeger, zitadel) + migrate + seed
pnpm --filter @org/server dev     # BFF on :3001
pnpm --filter @org/web dev        # Next.js on :3000 (browser-facing); /api/* rewrites to :3001
```
