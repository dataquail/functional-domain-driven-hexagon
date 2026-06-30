# ADR-0024: Repository ports are dumb persistence with a cardinality-explicit vocabulary, enforced by lint

- Status: Accepted
- Date: 2026-06-30

## Context and Problem Statement

A repository in this codebase is an outbound port: a `Context.Tag` whose `*RepositoryShape` lives in `domain/ports/repositories/`, with a `Live` implementation in `infrastructure/` that maps an aggregate to and from rows, and a `Fake` counterpart for unit tests. Its job is narrow — persist the current state of an aggregate and fetch it back. The aggregate carries the invariants and the domain verbs (grant, revoke, promote, activate, cancel); the use case orchestrates them and declares the transaction boundary; the repository only knows how to write the resulting state and read it again.

This boundary is easy to state and easy to erode. The recurring failure mode — especially from automated contributors extending the system — is business logic creeping into persistence:

- **Domain verbs on the port.** A method like `creditFunds`, `grantAccess`, or `markAsPaid` appears on the `*RepositoryShape`. It reads as behaviour, not storage. Once it exists on the port, the `Live` must implement it, and domain decisions end up expressed as SQL.
- **Application collaborators inside the `Live`.** The repository imports a use case (`commands/`, `queries/`, `event-handlers/`), or reaches for the application-tier buses and unit-of-work (`CommandBus`, `QueryBus`, `DomainEventBus`, `IntegrationEventBus`, `UnitOfWork`). Publishing events, dispatching commands, and owning the transaction are the use case's responsibility; a repository that imports them is doing more than persistence.

Prose conventions and review catch some of this, but not deterministically. There is also a second, softer problem: even among legitimately-dumb methods, naming drifted. `findByOrganizationId` returned a single `Subscription` in one module but a collection of `Membership` rows in another; `save`, `insert`, `remove`, and `delete` were mixed without a rule about operation size. A reader could not tell a method's cardinality from its name.

The question is how to make "repositories stay dumb" a mechanical guarantee rather than a habit — and, while we are at it, to standardize the vocabulary so every method names its cardinality.

## Decision

Repository ports speak a fixed, **cardinality-explicit vocabulary**, and two lint rules enforce the boundary at the two points where it erodes. The rules are guardrails, not airtight proofs, but they make the common violations fail the `check:all` gate.

### The vocabulary

Every repository method is one of:

- `insertOne` / `insertMany`
- `updateOne` / `updateMany`
- `deleteOne` / `deleteMany`
- `upsertOne` / `upsertMany` — for aggregates whose persistence reconciles "create or replace" in one step (the former `save`)
- `findOne` / `findMany`, each optionally followed by an `[<Qualifier>]By<Key>` lookup — `findOneById`, `findOneByEmail`, `findManyByOrganizationId`, `findOneByUserIdAndOrgId`, and with a qualifier `findOneOpenByOrganizationIdAndEmail`
- `findAll` / `findAll<Qualifier>` — a whole-collection read that takes no lookup key (`findAll`, `findAllActive`)

The `One`/`Many`/`All` size is the point: a caller reads the operation's cardinality off the method name. The same `By<Key>` lookup now disambiguates by cardinality — `findOneByOrganizationId` (the org's subscription) versus `findManyByOrganizationId` (the org's memberships) — where the old `findByOrganizationId` hid it.

Two read shapes, kept distinct: a **keyed** read is `find{One,Many}[<Qualifier>]By<Key>` — it takes a lookup argument, and an optional qualifier (e.g. `Open`) may sit in front of the `By<Key>` clause for a lookup that is also filtered (`findOneOpenByOrganizationIdAndEmail` returns the _open_ invitation for that pair). A **keyless** collection read is `findAll[<Qualifier>]` — no argument, where any qualifier (`findAllActive`) is a built-in filter. Because the qualifier on a keyed find is only allowed ahead of a `By<Key>`, a bare find-and-mutate name like `findOneAndDelete` (no `By`, not a `findAll`) is still rejected.

### 1. The port's method names — eslint `dumb-repository-ports`

A custom flat-config rule (`scripts/eslint-rules/dumb-repository-ports.mjs`), scoped to `packages/server/src/modules/*/domain/ports/repositories/*-repository.ts`. It inspects the `*RepositoryShape` type literal and requires every method name to match the vocabulary above:

```
^(?:(?:insert|update|delete|upsert)(?:One|Many)|findAll(?:[A-Z][A-Za-z0-9]*)?|find(?:One|Many)(?:(?:[A-Z][A-Za-z0-9]*)?By[A-Z][A-Za-z0-9]*)?)$
```

Anything else fails — a name that reads as a domain verb, or one that omits the `One`/`Many` size. The message points the contributor either to move the behaviour onto the aggregate or to add the cardinality.

The port is the right enforcement point because the `Live` and `Fake` must structurally satisfy it: constraining the port's surface transitively keeps both implementations dumb. A contributor cannot add `repo.creditFunds(...)` to the `Live` without first declaring it on the shape, where the rule rejects it.

### 2. What the `Live` collaborates with — dependency-cruiser `dumb-repository-live-no-app-collaborators`

The method-name allowlist stops domain-verb _methods_, but logic can still hide _inside_ a `save` body by collaborating with the application ring. A dependency-cruiser rule forbids `infrastructure/*-repository-live.ts` from importing:

- the module's own `commands/`, `queries/`, `event-handlers/` use cases, and
- the application-tier ports `command-bus`, `query-bus`, `domain-event-bus`, `integration-event-bus`, `unit-of-work`, `with-unit-of-work` under `platform/ddd/ports/`.

A repository that reaches for these is smuggling orchestration into persistence; the fix is to move it to the aggregate or the use case.

## Consequences

- The two highest-frequency forms of logic creep now fail CI deterministically, with messages that name the correct home for the misplaced behaviour.
- The rules are allowlists by name and import path. A determinedly misleading name (e.g. `findOneAndCredit`) or pure computation inside an `updateOne` body can still pass — these are guardrails against the common case, not a substitute for review. The bound is documented rather than silent.
- The whole codebase was migrated to the vocabulary in one pass (a type-aware ts-morph rename of every `*RepositoryShape` property and its references), so the rules were introduced against a conforming tree. The only method that did not fit the bare `find{One,Many}By<Key>` shape was `findOpenByOrganizationIdAndEmail` — its `Open` status filter is meaningful and worth keeping in the name. Rather than drop the signal, the grammar allows an optional qualifier ahead of the `By<Key>` clause, and the method became `findOneOpenByOrganizationIdAndEmail`.
- Reads that legitimately bypass the aggregate (read-side projections) live in `queries/` and address the database directly; they are unaffected, because they are not repositories.
