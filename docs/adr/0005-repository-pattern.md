# ADR-0005: Repository pattern (port in domain, Live + Fake in infrastructure)

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

The architecture demands three things of the persistence layer simultaneously:

1. **The domain layer is free of persistence concerns.** Domain code must compile and be reasoned about without knowing whether storage is SQL, in-memory, or remote.
2. **Use cases are unit-testable without a database.** A test that exercises a command handler should not require docker, migrations, or a connection pool.
3. **Production wiring supports transactions** that span multiple repository calls and event handlers, so that multi-aggregate writes triggered by domain events can commit atomically.

The repository pattern is the standard solution for (1) and (2). The third constraint adds a wrinkle: the repository needs to be _transaction-aware_ in production while remaining transaction-naive in unit tests.

## Decision

For each feature module:

### Port

The port lives in `domain/<feature>-repository.ts` as an Effect `Context.Tag`. Its method signatures are typed in terms of domain entities, not rows. Errors in the port's signature are domain errors (e.g. `UserNotFound`, `UserAlreadyExists`), not infrastructure errors.

```ts
export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    readonly insert: (user: User) => Effect.Effect<void, UserAlreadyExists>;
    readonly update: (user: User) => Effect.Effect<void, UserNotFound>;
    readonly remove: (id: UserId) => Effect.Effect<void, UserNotFound>;
    readonly findById: (id: UserId) => Effect.Effect<User, UserNotFound>;
    readonly findByEmail: (email: string) => Effect.Effect<Option<User>>;
  }
>() {}
```

### Live implementation

The live implementation lives in `infrastructure/<feature>-repository-live.ts` as a `Layer.effect` that depends on the shared `Database` service. Every method is built via the database's `makeQuery` helper, which automatically joins any active transaction context (see ADR-0007). Database-level errors are translated to domain errors via `Effect.catchTag`; non-domain failures are dropped to defects (`Effect.die`).

### Fake implementation

A fake implementation lives in `infrastructure/<feature>-repository-fake.ts` as a `Layer.effect` backed by a `Ref<Map<EntityId, Entity>>`. Use-case unit tests provide it instead of the live implementation. The fake satisfies the same port, so the use case sees no difference between fake and live.

### Mapper

Persistence-format conversion lives in `infrastructure/<feature>-mapper.ts` as a pair of plain functions: `toPersistence(entity) -> Row` and `toDomain(row) -> entity`. The live implementation uses these; tests can use them too if needed.

### Test exemption

Static analysis allows test files in `application/` to import from `infrastructure/` (so unit tests can pull in the fake). Production application code may not (see ADR-0008).

## Consequences

- The domain layer has zero infrastructure dependencies. It compiles after deleting the entire `infrastructure/` folder for a module.
- Use-case unit tests need only the fake repository, the recording event bus, and the identity transaction runner. No database, no docker, no migrations.
- Two implementations of the same port must stay in sync. The shared port type makes signature drift a compile error; a "fake repository" test file exercises the fake against the same scenarios as the live integration test, catching behavioral drift.
- The fake's data shape is in-memory entities, so error semantics differ from the live implementation in narrow ways (unique-violation detection is a `Map` lookup, not a Postgres `unique_violation`). The port hides this — both implementations satisfy the same `UserAlreadyExists` contract.
- Repositories are _transaction-passive_: they don't open or close transactions; they participate in whatever transaction context is active. This keeps the pattern composable with the unit-of-work mechanism (ADR-0007) and matches real database semantics, where a repository call is a participant in a transaction, not its owner.

## Alternatives considered

- **No repository abstraction; use cases call `db.execute(sql...)` directly.** Rejected — couples the domain to SQL, prevents fake-based unit tests of use cases, and concentrates persistence knowledge at every call site instead of in one place per aggregate.
- **Generic `Repository<T>` base class** with CRUD operations. Rejected — generic CRUD methods rarely fit; per-aggregate ports stay smaller, more honest about what's actually queryable, and don't push consumers into pretending all aggregates are uniform.
- **ORM-managed entities** (with proxies or change-tracking). Rejected — leaks persistence concerns into the domain via lazy-loading and identity-map semantics, and historically has not stayed out of the way once the schema gets complex.
- **Single in-memory implementation used in both production and tests.** Rejected for production for obvious reasons; tempting for prototypes, but the discipline of having two implementations from day one is cheap insurance against the pattern getting bypassed under deadline pressure.

## Related

- ADR-0001 (functional core) — domain has no infrastructure dependencies.
- ADR-0007 (transaction runner) — explains how the live repository's per-call transaction-context check makes it transaction-aware.
- ADR-0009 (testing) — explains how the fake fits into the use-case unit tests.
