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
