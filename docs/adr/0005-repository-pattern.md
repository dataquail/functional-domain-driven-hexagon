# ADR-0005: Repository pattern — dumb, specification-queried ports (Live + Fake in infrastructure)

- Status: Accepted
- Date: 2026-07-13

## Context and Problem Statement

The architecture demands several things of the persistence layer simultaneously:

1. **The domain layer is free of persistence concerns.** Domain code must compile and be reasoned about without knowing whether storage is SQL, in-memory, or remote.
2. **Use cases are unit-testable without a database.** A test that exercises a command handler should not require docker, migrations, or a connection pool.
3. **Production wiring supports transactions** that span multiple repository calls and event handlers, so multi-aggregate writes triggered by domain events commit atomically.
4. **The repository stays dumb.** Its job is narrow — persist the current state of an aggregate and fetch it back. The aggregate carries the invariants and the domain verbs (grant, revoke, promote); the use case orchestrates them and declares the transaction boundary; the repository only writes the resulting state and reads it again.

The fourth demand is easy to state and easy to erode. The recurring failure mode — especially from automated contributors — is business logic creeping into persistence: a domain-verb method (`creditFunds`, `grantAccess`, `markAsPaid`) appears on the port and forces the `Live` to express domain decisions as SQL; or the `Live` imports a use case or an application-tier bus and starts publishing events / owning the transaction. A softer failure is read-method bloat: a new `findOneOpenByOrganizationIdAndEmail` / `findManyActiveByUser` for every variant a use case needs, each re-encoding a domain predicate as bespoke SQL that then drifts from the same rule expressed in memory.

## Decision

For each aggregate: a port in its subdomain folder (`domain/<subdomain>/`), a `Live` and `Fake` in `infrastructure/repositories/`, and a mapper. Reads are expressed with **specifications** — a domain predicate that also carries a translatable criteria AST — and the port speaks a fixed, minimal vocabulary that two lint rules keep dumb.

### Port

The port lives in its aggregate's subdomain folder, `domain/<subdomain>/<feature>.repository.ts`, as a `Context.Service`. Its method signatures are typed in terms of domain aggregates, not rows. The transient-store failure is the domain-language `PersistenceUnavailable` (from `platform/ddd/contracts/`). Absence is a plain `null` (for `findOne`) or an empty array (for `findMany`); mapping a `null` to a domain `NotFound` is the use case's job, since which not-found error applies depends on the caller.

```ts
export type UserRepositoryShape = {
  readonly insertOne: (user: UserRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (user: UserRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<UserRoot>,
  ) => Effect.Effect<UserRoot | null, PersistenceUnavailable>;
  readonly findMany: (
    spec: Specification<UserRoot>,
  ) => Effect.Effect<ReadonlyArray<UserRoot>, PersistenceUnavailable>;
};

export class UserRepository extends Context.Service<UserRepository, UserRepositoryShape>()(
  "UserRepository",
) {}
```

### The vocabulary

Every repository method is one of:

- `insertOne` / `insertMany`, `updateOne` / `updateMany`, `deleteOne` / `deleteMany`, `upsertOne` / `upsertMany` — writes, typed in terms of the aggregate (or its identity for a delete).
- `findOne` / `findMany` — the **only** reads. Each takes a `Specification` and returns `T | null` / `ReadonlyArray<T>`.

There are no `findOneById` / `findManyByX` / `findOneOpenBy…` methods. Identity lookups, natural-key lookups, and variant selection are all expressed as a specification at the call site — `repo.findOne(UserSpecifications.withEmail(email))`, `repo.findOne(Spec.and(forOrganization(orgId), withInviteeEmail(email), isOpen))`. This kills read-method bloat (one `findOne` instead of a keyed method per lookup) and, because the same specification object filters the fake and compiles the live query, kills the fake/live drift that per-variant SQL invited.

### Specification: one predicate, two interpreters

A `Specification<T>` (in `platform/ddd/contracts/`) is a **callable predicate that also carries a translatable `Criteria` AST**. Builders — `Spec.eq`, `Spec.isNull`, `Spec.isNotNull`, `Spec.and`, `Spec.or`, `Spec.not` — produce both halves at once, so a spec is defined once and used three ways:

- **Domain guards** (`RootOps`) call it as a predicate: `if (InvitationSpecifications.isAccepted(invitation)) …`.
- **The fake repository** filters in memory with the same object: `rows.find(spec)`.
- **The live repository** compiles its `.criteria` to a SQL `WHERE` fragment with `criteriaToWhere(spec.criteria, columns)`.

A spec named after a lookup lives in the aggregate's `*.specification.ts` (`withId`, `withEmail`, `forOrganization`, `isOpen`); ad-hoc composition happens at the call site with `Spec.and` / `Spec.or` / `Spec.not`.

### The boundary: what a specification may express

The `Criteria` AST has only **root-level scalar** nodes (`Eq`, `IsNull`, `IsNotNull` over the root's own columns, combined with `And`/`Or`/`Not`). It has no "some child row matches" node. This is deliberate:

- The **specification carries only the predicate**; the **repository owns FROM, JOINs, projection, ordering, and — for a multi-row aggregate — reconstitution**. The compiler emits nothing but the `WHERE`. The field→column map (which may name qualified columns of a fixed multi-table query) lives in the mapper.
- A predicate that reaches into a child collection (e.g. `OrganizationRolesSpecifications.hasRole`) cannot be built as a `Criteria`, so it is a plain `Predicate<T>` — usable as a guard, in the fake, or as a post-load filter, but **not assignable to `findOne`/`findMany`**. The type system refuses to hand a join-shaped filter to the repository. A filter that genuinely needs dynamic joins or child-collection matching is a bespoke repo query (a two-phase "`SELECT` ids `WHERE …`, then load by id" the repo writes by hand) or a read-side projection (ADR-0002) — never the generic compiler.

### Live implementation

The live implementation lives in `infrastructure/repositories/<feature>.repository-live.ts` as a `Layer` that depends on the shared `Database` service. Every method is built via the database's `makeQuery` helper, which automatically joins any active transaction context (see ADR-0007). A read runs `SELECT <projection> FROM <tables/joins> WHERE ${criteriaToWhere(spec.criteria, columns)}` — the repo owns everything but the `WHERE`. Database-level errors are translated at this boundary; a transient outage surfaces as `PersistenceUnavailable`, and non-domain failures drop to defects (`Effect.die`).

### Fake implementation

A fake implementation lives in `infrastructure/repositories/<feature>.repository-fake.ts` as a `Layer` backed by a `Ref` of stored aggregates. `findOne` / `findMany` filter with the specification directly (`Array.from(values).find(spec)` / `.filter(spec)`). The fake must mirror the live repository's **row model**, not just its predicate: an aggregate the live repo persists as zero rows (e.g. a multi-row aggregate whose collection is now empty) must be un-findable in the fake too, so an empty-aggregate upsert deletes the stored entry rather than retaining it.

### Mapper

Persistence-format conversion lives in `infrastructure/repositories/<feature>.mapper.ts`: `toPersistence(entity) -> Row`, `toDomain(rows) -> entity | null`, and the `columns` field→column map the compiler consumes. A **single-row** aggregate maps one row to one aggregate (`findOne` runs `maybeOne(… LIMIT 1)`). A **multi-row** aggregate reconstitutes one aggregate from the row set the spec's `WHERE` returns (`findOne` runs `any(…)`, groups, and returns `null` for zero rows); identity is read from the rows. For variant aggregates the mapper switches on the persisted discriminant column (ADR-0003), keeping the `Live` dumb. Because "no rows" and "empty aggregate" are the same state, the empty aggregate is synthesized by the caller (`… ?? XRootOps.empty(id)`), not by the repository.

### Two lint rules keep the port dumb

1. **eslint `dumb-repository-ports`**, scoped to the subdomain repository ports (`domain/<subdomain>/*.repository.ts`), inspects the `*RepositoryShape` type literal and requires every method name to be one of the write verbs or bare `findOne` / `findMany`. A name that reads as a domain verb, omits the `One`/`Many` size, or is a keyed/variant finder (`findOneById`, `findOneOpenBy…`) fails — the message tells the contributor to move behaviour onto the aggregate or express the lookup as a specification. The port is the right enforcement point because the `Live` and `Fake` must structurally satisfy it.
2. **dependency-cruiser `dumb-repository-live-no-app-collaborators`** forbids `infrastructure/repositories/*.repository-live.ts` from importing the module's own `commands/` / `queries/` use cases, or the application-tier ports (`command-bus`, `query-bus`, `domain-event-bus`, `integration-event-bus`, `unit-of-work`, `with-unit-of-work`). A repository that reaches for these is smuggling orchestration into persistence.

Both are allowlists: a determinedly misleading name or pure computation inside an `updateOne` body can still pass. They are guardrails against the common case, not a substitute for review.

### Test exemption

Static analysis allows test files in `commands/` and `queries/` to import from `infrastructure/` (so unit tests can pull in the fake). Production code in those folders may not (see ADR-0008).

## Consequences

- The domain layer has zero infrastructure dependencies. It compiles after deleting the entire `infrastructure/` folder for a module.
- Use-case unit tests need only the fake repository, the recording event bus, and the identity unit of work. No database, no docker, no migrations.
- A variant/lookup is defined once, as a specification, and reused by guards, the fake, and the live query — so "open", "not deleted", "by email" cannot drift between an in-memory rule and a hand-written `WHERE`.
- Two implementations of the same port must stay in sync. The shared port type makes signature drift a compile error; a fake-repository test and the live integration test exercise the same specifications, catching behavioral drift (including row-model mismatches like the empty-aggregate case).
- Repositories are _transaction-passive_: they don't open or close transactions; they participate in whatever transaction context is active. This keeps the pattern composable with the unit-of-work mechanism (ADR-0007) and matches real database semantics.
- Reads that legitimately bypass the aggregate (read-side projections) live in `queries/` and address the database directly; they are unaffected, because they are not repositories. Filtered loads that would need dynamic joins stay on the read side rather than distorting the specification DSL.

## Alternatives considered

- **Cardinality-explicit keyed finders** (`findOneById`, `findManyByOrganizationId`, `findOneOpenBy…`) — the previous decision. Rejected — every new variant added a port method plus a bespoke `WHERE`, and the same predicate expressed in the fake (in memory) and the live (as SQL) drifted. The specification collapses both into one object.
- **Query-object specifications that own the whole query** (FROM/JOIN/projection). Rejected — a spec that knows table and column layout leaks persistence into the domain and re-introduces an ORM. The spec owns only the predicate; the repository owns the physical query.
- **No repository abstraction; use cases call `db.execute(sql...)` directly.** Rejected — couples the domain to SQL, prevents fake-based unit tests, and concentrates persistence knowledge at every call site.
- **Generic `Repository<T>` base class** with CRUD operations. Rejected — writes stay per-aggregate and honest; only the read surface (`findOne`/`findMany` over a spec) is uniform.
- **ORM-managed entities** (proxies / change-tracking). Rejected — leaks persistence concerns into the domain via lazy-loading and identity-map semantics.
- **Domain-verb methods on the port** (`repo.creditFunds(...)`). Rejected — that is business logic; it belongs on the aggregate's `RootOps`. The `dumb-repository-ports` rule rejects it by name.

## Related

- ADR-0001 (functional core) — domain has no infrastructure dependencies.
- ADR-0003 (aggregates) — the `RootOps` that own the invariants specifications guard.
- ADR-0007 (unit of work) — explains how the live repository's per-call transaction-context check makes it transaction-aware.
- ADR-0009 (testing) — explains how the fake fits into the use-case unit tests.
