# ADR-0009: Testing pyramid (four levels, two disjoint suites)

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

A testing strategy has to balance feedback speed, confidence, infrastructure cost, and cognitive load simultaneously. A single test level cannot satisfy all of them.

The forces:

- Most tests should run in milliseconds, on a developer machine with no auxiliary services. `pnpm test` should succeed without docker, without a database, without environment configuration.
- Some tests need a real database to be meaningful (the persistence layer; the end-to-end behavior of cross-module event subscribers participating in a transaction). These run in CI and are a separate, deliberate suite.
- The boundary between "this needs a database" and "this doesn't" should be visible from the test file's name, not buried in setup code.
- The tools that make use-case tests fast (in-memory fakes, recording event bus, identity unit of work) must be cheap to compose.
- Production destructive operations (dropping schemas, truncating tables) must not be possible against a non-test database, even by accident.

## Decision

Four test levels, each with a distinct location, runtime, and purpose:

| Level                    | Location                                                                                                                                       | Runtime                                                                  | DB  | Covers                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------- |
| Domain unit              | `modules/<f>/domain/<subdomain>/*.root-ops.test.ts` + `*.specification.test.ts`, `modules/<f>/domain/domain-services/*.domain-service.test.ts` | `Effect.runSync` or none                                                 | no  | Pure ops, invariants, predicates, validation                                                                        |
| Use-case unit            | `modules/<f>/commands/*.handler.test.ts`                                                                                                       | Effect runtime + fake repo + recording event bus + identity unit of work | no  | Command behavior, event emission, error paths                                                                       |
| Query / repo integration | `modules/<f>/queries/*.handler.integration.test.ts`, `modules/<f>/infrastructure/repositories/*.repository-live.integration.test.ts`           | Real Effect runtime + test database                                      | yes | Live SQL projections and mapping; unique-violation mapping; transaction-context joining                             |
| HTTP E2E                 | `modules/<f>/interface/http/*.endpoint.integration.test.ts`                                                                                    | Full Layer graph against an in-process HTTP server                       | yes | End-to-end behavior including event subscribers, HTTP serialization, status codes (one file per endpoint, ADR-0013) |

### Two disjoint suites, selected by file suffix + the `TEST_INTEGRATION` toggle

Tests requiring a real database are suffixed `.integration.test.ts`. The two suites never overlap (selection lives in `vitest.shared.ts`):

- **`pnpm test`** runs the **unit** suite — every `*.test.ts` _except_ `*.integration.test.ts` — and needs no auxiliary services.
- **`pnpm test:integration`** sets `TEST_INTEGRATION=true` (scoped to `@org/server` + `@org/jobs`) and runs **only** `*.integration.test.ts`.

Integration tests are **dumb — they do not self-skip.** The integration global-setup hard-fails: it asserts `DATABASE_URL_TEST` is set (and that its name contains `test`), then connects, so a missing or unreachable database aborts the whole run rather than silently skipping. Provide `DATABASE_URL_TEST` before running `pnpm test:integration`. A silent skip would let a coverage regression pass green; a hard failure cannot.

### Test database safety

The test infrastructure refuses to migrate or truncate any database whose name does not contain `test`:

```ts
if (!name.toLowerCase().includes("test")) {
  throw new Error(`refusing to operate on '${name}' — DATABASE_URL_TEST name must contain 'test'`);
}
```

Migration replay is destructive (it drops every module schema; ADR-0011, ADR-0021). The guard is the only defense against a developer accidentally pointing the test runner at a development or production database; the cost of the guard is zero, and the cost of getting it wrong is a wiped database.

### Test-only services

Three layered components together make use-case unit tests possible without a database:

- **Recording event bus.** Implements the `DomainEventBus` interface by appending dispatched events to an in-memory ref. Subscribers are no-ops. Tests assert against the recorded log via a `byTag` helper.
- **`IdentityUnitOfWork`.** Implements the `UnitOfWork` port as the identity function on its inner effect. No transaction is opened. Fake repositories don't consult transaction context, so this is a faithful pass-through (ADR-0007).
- **In-memory fake repositories.** Per-module, port-shaped, backed by `Ref<Map<EntityId, Entity>>`. Satisfies the same port as the live implementation (ADR-0005).

These three plus the Effect runtime are the entire dependency graph for a use-case unit test.

### HTTP integration setup via a shared helper

HTTP integration tests use `useServerTestRuntime(["table1", "table2"])` from `test-utils/`, which wires `ManagedRuntime.make(TestServerLive)` + `beforeAll`/`afterAll` + per-test `truncate`. Tests exercise the contract via `HttpApiClient.make(Api)` and seed prior state by calling _other endpoints_, not by reaching into module internals. Query/repository integration tests seed via the live repository (or other production-path code), not raw SQL — keeping the test honest about what production paths look like.

### What is _not_ in this strategy

- **No BDD / Gherkin scenarios.** Plain `describe` / `it` with explicit assertions. The indirection costs more than it pays back at this scale.
- **No load tests committed to the repo.** If load testing is needed, it happens out-of-band against a deployed environment.
- **No mutation tests, no contract tests against the client.** HTTP E2E covers what the client actually exercises; if client and server contracts drift, the type checker on the shared schema package catches it.

## Consequences

- The vast majority of tests run in milliseconds with no auxiliary infrastructure. A first-day contributor runs the full unit suite with nothing beyond `pnpm install`.
- The integration suite is deliberate and separate — `pnpm test:integration` against a real Postgres — and cannot be run by accident, nor silently skipped.
- Fake-vs-live drift is a real risk. Two mitigations: (1) the shared port type makes signature drift a compile error; (2) the fake has its own integration-style test exercising it through the same scenarios as the live implementation.
- The HTTP E2E test for cross-module event subscribers is the only test that proves transactional event dispatch end-to-end. Treat it as load-bearing: if it gets disabled, that's a coverage regression even if every unit test passes — the _interaction_ between the unit of work, the synchronous event bus, and the live repositories is what makes ADR-0007 work in production.

## Alternatives considered

- **All tests require a real database.** Rejected — makes the unit suite slow and discourages fine-grained tests.
- **All tests use fakes.** Rejected — leaves no integration coverage of persistence or event dispatch; bugs that only surface against a real Postgres are invisible.
- **Integration tests that self-skip when the DB is absent.** Rejected — a skip-when-unset toggle silently drops coverage; the hard-failing global-setup makes a missing DB a loud error, so "the integration suite ran" means it actually ran.
- **Behavior-driven tests with Gherkin scenarios.** Rejected for this codebase — the indirection costs more than it pays back; plain `describe` / `it` is just as readable to engineers.

## Related

- ADR-0005 (repository pattern) — the fake / live split is what makes use-case unit tests possible.
- ADR-0007 (unit of work) — the identity unit of work is what makes those tests transaction-naive.
- ADR-0008 (architecture enforcement) — the test-file exemption in the per-folder isolation rules lets unit tests import the fake from `infrastructure/`.
- ADR-0013 (HTTP endpoint conventions) — the per-endpoint integration test is the HTTP E2E test described here.
