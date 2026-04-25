# ADR-0009: Testing pyramid (four levels, opt-in integration)

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

A testing strategy has to balance several concerns simultaneously: feedback speed, confidence, infrastructure cost, and cognitive load on the people writing the tests. A single test level cannot satisfy all of them.

The forces:

- Most tests should run in milliseconds, on a developer machine with no auxiliary services. `pnpm test` should succeed without docker, without a database, without environment configuration.
- Some tests need a real database to be meaningful (the persistence layer; the end-to-end behavior of cross-module event subscribers participating in a transaction). These tests should exist, should run in CI, and should be opt-in for local development.
- The boundary between "this needs a database" and "this doesn't" should be visible from the test file's name, not buried in setup code.
- The tools that make use-case tests fast (in-memory fakes, recording event bus, identity transaction runner) must be cheap to use — composing them should not require boilerplate at the start of every test file.
- Production destructive operations (dropping schemas, truncating tables) must not be possible against a non-test database, even by accident.

## Decision

Four test levels, each with a distinct location, runtime, and purpose:

| Level                  | Location                                                                                                                      | Runtime                                                                        | DB  | Covers                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------- |
| Domain unit            | `modules/<f>/domain/*.test.ts`                                                                                                | `Effect.runSync` or none                                                       | no  | Pure ops, invariants, validation                                                                         |
| Use-case unit          | `modules/<f>/application/**/*.test.ts`                                                                                        | Effect runtime + fake repo + recording event bus + identity transaction runner | no  | Command/query handler behavior, event emission, error paths                                              |
| Repository integration | `modules/<f>/infrastructure/*-repository-live.integration.test.ts`                                                            | Real Effect runtime + test database                                            | yes | Live SQL queries map correctly to domain entities; unique-violation mapping; transaction-context joining |
| HTTP E2E               | `modules/<f>/interface/*-http-live.integration.test.ts` and cross-module subscriber tests under `application/event-handlers/` | Full Layer graph against an in-process HTTP server                             | yes | End-to-end behavior including event subscribers, HTTP serialization, status codes                        |

### Naming convention

Tests requiring a real database are suffixed `.integration.test.ts`. They self-skip at runtime when the test-database environment variable is unset:

```ts
const suite = hasTestDatabase ? describe.sequential : describe.skip;
```

This lets `pnpm test` succeed with no auxiliary services running. Integration tests are opt-in via a single environment variable.

### Test database safety

The test infrastructure refuses to migrate or truncate any database whose name does not contain `test`:

```ts
if (!name.toLowerCase().includes("test")) {
  throw new Error(`refusing to operate on '${name}' — database name must contain 'test'`);
}
```

Migration replay is destructive (it drops the public schema). The guard is the only defense against a developer accidentally pointing the test runner at a development or production database; the cost of the guard is zero, and the cost of getting it wrong is a wiped database.

### Test-only services

Three layered components that together make use-case unit tests possible without a database:

- **Recording event bus.** Implements the `DomainEventBus` interface by appending dispatched events to an in-memory ref. Subscribers are no-ops. Tests assert against the recorded log via a `byTag` helper.
- **Identity transaction runner.** Implements the `TransactionRunner` interface as the identity function on its inner effect. No transaction is opened. Fake repositories don't consult transaction context, so this is a faithful pass-through.
- **In-memory fake repositories.** Per-module, port-shaped, backed by `Ref<Map<EntityId, Entity>>`. Satisfies the same port as the live implementation (see ADR-0005).

These three plus the Effect runtime are the entire dependency graph for a use-case unit test.

### What is _not_ in this strategy

- **No BDD / Gherkin scenarios.** Plain `describe` / `it` with explicit assertions. The indirection between scenario text and assertions is more cost than benefit at this scale.
- **No load tests committed to the repo.** If load testing is needed, it happens out-of-band against a deployed environment.
- **No mutation tests, no contract tests against the client.** HTTP E2E covers what the client actually exercises; if the client and server contracts drift, the type checker on the shared schema package catches it.

## Consequences

- The vast majority of tests run in milliseconds with no auxiliary infrastructure. A first-day contributor can run the full unit test suite without setup beyond `pnpm install`.
- Integration tests are deliberate. A developer running them locally does so explicitly: `DATABASE_URL_TEST=postgres://localhost:5432/foo_test pnpm test`. The skip-when-unset behavior is the ergonomic affordance that makes opt-in actually opt-in.
- Fake-vs-live drift is a real risk. Two mitigations: (1) the shared port type makes signature drift a compile error, and (2) the fake has its own integration-style test that exercises it through the same scenarios as the live implementation's integration test. Behavioral drift is caught by both tests passing for the same scenarios with different backends.
- The HTTP E2E test for cross-module event subscribers is the only test that proves transactional event dispatch end-to-end. If it gets disabled, that's a coverage regression even if every unit test passes — the _interaction_ between the transaction runner, the synchronous event bus, and the live repositories is what makes ADR-0007 actually work in production. Treat that test as load-bearing.

## Alternatives considered

- **All tests require a real database.** Simplest model. Rejected — makes the unit test suite slow, makes contributing more expensive, and discourages writing fine-grained tests because each one carries database setup cost.
- **All tests use fakes.** Fastest. Rejected — leaves no integration coverage of the persistence layer or the event-dispatch interaction; bugs that only surface against a real Postgres are invisible.
- **Single integration suite, no fakes.** Rejected for the same reasons as "all tests require a real database."
- **Behavior-driven tests with Gherkin scenarios.** Educational value and stakeholder readability are real. Rejected for this codebase: the indirection costs more than it pays back at our scale, and plain `describe` / `it` with descriptive names is just as readable to engineers.

## Related

- ADR-0005 (repository pattern) — the fake / live split is what makes use-case unit tests possible.
- ADR-0007 (transaction runner) — the identity runner is what makes those tests transaction-naive.
- ADR-0008 (architecture enforcement) — the test exemption to the application-to-infrastructure rule is what lets unit tests import the fake.
