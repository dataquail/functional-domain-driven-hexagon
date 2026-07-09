# ADR-0005: Repository pattern — dumb, cardinality-explicit ports (Live + Fake in infrastructure)

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

The architecture demands several things of the persistence layer simultaneously:

1. **The domain layer is free of persistence concerns.** Domain code must compile and be reasoned about without knowing whether storage is SQL, in-memory, or remote.
2. **Use cases are unit-testable without a database.** A test that exercises a command handler should not require docker, migrations, or a connection pool.
3. **Production wiring supports transactions** that span multiple repository calls and event handlers, so multi-aggregate writes triggered by domain events commit atomically.
4. **The repository stays dumb.** Its job is narrow — persist the current state of an aggregate and fetch it back. The aggregate carries the invariants and the domain verbs (grant, revoke, promote); the use case orchestrates them and declares the transaction boundary; the repository only writes the resulting state and reads it again.

The fourth demand is easy to state and easy to erode. The recurring failure mode — especially from automated contributors — is business logic creeping into persistence: a domain-verb method (`creditFunds`, `grantAccess`, `markAsPaid`) appears on the port and forces the `Live` to express domain decisions as SQL; or the `Live` imports a use case or an application-tier bus and starts publishing events / owning the transaction. A softer failure is naming drift: `findByOrganizationId` returning a single row in one module and a collection in another, so a reader can't tell a method's cardinality from its name.

## Decision

For each feature module: a port in `domain/ports/repositories/`, a `Live` and `Fake` in `infrastructure/repositories/`, and a mapper. The port speaks a fixed, **cardinality-explicit vocabulary**, and two lint rules keep it dumb.

### Port

The port lives in `domain/ports/repositories/<feature>.repository.ts` as a `Context.Service`. Its method signatures are typed in terms of domain aggregates, not rows. The transient-store failure is the domain-language `PersistenceUnavailable` (from `platform/ddd/contracts/`); absence is modeled as `Option` or an empty aggregate rather than a thrown `NotFound` where that reads better.

```ts
export type UserRepositoryShape = {
  readonly insertOne: (user: UserRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (user: UserRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly deleteOne: (id: UserId) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneById: (id: UserId) => Effect.Effect<Option<UserRoot>, PersistenceUnavailable>;
  readonly findOneByEmail: (
    email: string,
  ) => Effect.Effect<Option<UserRoot>, PersistenceUnavailable>;
};

export class UserRepository extends Context.Service<UserRepository, UserRepositoryShape>()(
  "UserRepository",
) {}
```

### The cardinality-explicit vocabulary

Every repository method is one of:

- `insertOne` / `insertMany`
- `updateOne` / `updateMany`
- `deleteOne` / `deleteMany`
- `upsertOne` / `upsertMany` — for aggregates whose persistence reconciles "create or replace" in one step
- `findOne` / `findMany`, each optionally followed by an `[<Qualifier>]By<Key>` lookup — `findOneById`, `findOneByEmail`, `findManyByOrganizationId`, `findOneByUserIdAndOrgId`, and with a qualifier `findOneOpenByOrganizationIdAndEmail`
- `findAll` / `findAll<Qualifier>` — a whole-collection read that takes no lookup key (`findAll`, `findAllActive`)

The `One`/`Many`/`All` size is the point: a caller reads the operation's cardinality off the method name. The same `By<Key>` lookup disambiguates by cardinality — `findOneByOrganizationId` (the org's subscription) versus `findManyByOrganizationId` (the org's memberships) — where a bare `findByOrganizationId` would hide it. A keyless collection read is `findAll[<Qualifier>]`; a keyed read is `find{One,Many}[<Qualifier>]By<Key>`. Because a qualifier on a keyed find is only allowed ahead of the `By<Key>`, a find-and-mutate name like `findOneAndDelete` is rejected.

### Live implementation

The live implementation lives in `infrastructure/repositories/<feature>.repository-live.ts` as a `Layer` that depends on the shared `Database` service. Every method is built via the database's `makeQuery` helper, which automatically joins any active transaction context (see ADR-0007). Database-level errors are translated at this boundary; a transient outage surfaces as `PersistenceUnavailable`, and non-domain failures drop to defects (`Effect.die`).

### Fake implementation

A fake implementation lives in `infrastructure/repositories/<feature>.repository-fake.ts` as a `Layer` backed by a `Ref<Map<EntityId, Entity>>`. Use-case unit tests provide it instead of the live implementation. The fake satisfies the same port, so the use case sees no difference between fake and live.

### Mapper

Persistence-format conversion lives in `infrastructure/repositories/<feature>.mapper.ts` as a pair of plain functions: `toPersistence(entity) -> Row` and `toDomain(row) -> entity`. For variant aggregates the mapper switches on the persisted discriminant column to reconstitute the right variant (ADR-0003), keeping the `Live` dumb.

### Two lint rules keep the port dumb

The two highest-frequency forms of logic creep fail `check:all` deterministically:

1. **eslint `dumb-repository-ports`** (`scripts/eslint-rules/dumb-repository-ports.mjs`), scoped to `domain/ports/repositories/*.repository.ts`, inspects the `*RepositoryShape` type literal and requires every method name to match the vocabulary above. A name that reads as a domain verb, or omits the `One`/`Many` size, fails — the message tells the contributor to move the behaviour onto the aggregate or add the cardinality. The port is the right enforcement point because the `Live` and `Fake` must structurally satisfy it.
2. **dependency-cruiser `dumb-repository-live-no-app-collaborators`** forbids `infrastructure/repositories/*.repository-live.ts` from importing the module's own `commands/` / `queries/` / `event-handlers/` use cases, or the application-tier ports (`command-bus`, `query-bus`, `domain-event-bus`, `integration-event-bus`, `unit-of-work`, `with-unit-of-work`). A repository that reaches for these is smuggling orchestration into persistence.

Both are allowlists (by name and by import path): a determinedly misleading name or pure computation inside an `updateOne` body can still pass. They are guardrails against the common case, not a substitute for review.

### Test exemption

Static analysis allows test files in `commands/`, `queries/`, and `event-handlers/` to import from `infrastructure/` (so unit tests can pull in the fake). Production code in those folders may not (see ADR-0008).

## Consequences

- The domain layer has zero infrastructure dependencies. It compiles after deleting the entire `infrastructure/` folder for a module.
- Use-case unit tests need only the fake repository, the recording event bus, and the identity unit of work. No database, no docker, no migrations.
- Two implementations of the same port must stay in sync. The shared port type makes signature drift a compile error; a fake-repository test exercises the fake against the same scenarios as the live integration test, catching behavioral drift.
- Repositories are _transaction-passive_: they don't open or close transactions; they participate in whatever transaction context is active. This keeps the pattern composable with the unit-of-work mechanism (ADR-0007) and matches real database semantics.
- Method cardinality is legible from the name. Reads that legitimately bypass the aggregate (read-side projections) live in `queries/` and address the database directly; they are unaffected, because they are not repositories.

## Alternatives considered

- **No repository abstraction; use cases call `db.execute(sql...)` directly.** Rejected — couples the domain to SQL, prevents fake-based unit tests, and concentrates persistence knowledge at every call site.
- **Generic `Repository<T>` base class** with CRUD operations. Rejected — generic CRUD rarely fits; per-aggregate ports stay smaller and more honest about what's actually queryable.
- **ORM-managed entities** (proxies / change-tracking). Rejected — leaks persistence concerns into the domain via lazy-loading and identity-map semantics.
- **Single in-memory implementation used in both production and tests.** Rejected — the discipline of two implementations from day one is cheap insurance against the pattern getting bypassed under deadline pressure.
- **Domain-verb methods on the port** (`repo.creditFunds(...)`). Rejected — that is business logic; it belongs on the aggregate's `RootOps`. The `dumb-repository-ports` rule rejects it by name.

## Related

- ADR-0001 (functional core) — domain has no infrastructure dependencies.
- ADR-0007 (unit of work) — explains how the live repository's per-call transaction-context check makes it transaction-aware.
- ADR-0009 (testing) — explains how the fake fits into the use-case unit tests.
