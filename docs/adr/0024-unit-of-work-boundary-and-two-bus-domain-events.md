# ADR-0024: withUnitOfWork boundary, nested savepoints, and two-bus domain events

- Status: Accepted
- Date: 2026-06-20

> Extends ADR-0007. The unit of work and the synchronous in-fiber `DomainEventBus` from
> ADR-0007 are unchanged in their atomicity guarantees; this ADR reshapes how the boundary is
> declared, restores real nested savepoints, and adds the eventually-consistent second bus that
> ADR-0007 named as a non-goal and deferred. ADR-0007's "don't extend the in-process bus to do
> double duty — add a separate mechanism" guidance is exactly what this ADR follows.

## Context and Problem Statement

Three rough edges surfaced in the ADR-0007 model as the codebase grew.

1. **The transaction boundary was an inner block, not a use-case boundary.** A command handler
   wrapped part of its body in `uow.run(Effect.gen(...))`, while synchronously-dispatched event
   handlers participated in that same transaction _without_ any wrapping. The asymmetry made the
   inner-callback shape feel wrong: the transaction is a property of the whole use case, but it
   read like an implementation detail buried mid-function. Every handler also repeated the same
   `.pipe(Effect.catchTag("DatabaseError", Effect.die))` ceremony.

2. **Nested `uow.run` flattened.** A unit of work nested inside another (e.g. auth's just-in-time
   sign-in firing the user module's create command) joined the parent transaction with no
   savepoint. A nested failure could only take down the whole transaction; there was no way for a
   caller to attempt a sub-operation, catch its failure, and still commit the outer work. Flatten
   was an expedient fix for an earlier re-entrancy bug, not the intended behavior.

3. **One synchronous bus conflated two consistency models.** Every domain-event subscriber ran
   in-fiber, in the publisher's transaction. That is correct for "create a wallet when an
   organization is created" — the two writes are one logical unit. It is wrong for cross-aggregate
   reactions like "send a welcome email" or "sync a read model," which want **eventual**
   consistency: run after commit, in their own transaction, and never undo the trigger if they
   fail. DDD guidance — one aggregate per transaction, eventual consistency _between_ aggregates —
   makes eventual the sensible default for new cross-aggregate work, which the single in-tx bus
   could not express.

## Decision

### 1. `withUnitOfWork` — the boundary combinator

The use-case-facing API is a combinator applied at the end of a handler's pipe, the way
Cosmic-Python writes `with uow:` at the top of a handler:

```ts
export const createUser = (cmd: CreateUserCommand) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    // ... build the next state and the events purely ...
    yield* repo.insert(user);
    yield* bus.dispatch(events);
    return user.id;
  }).pipe(withUnitOfWork);
```

The transaction is now declared once, visibly and locally, at the use-case boundary — not as an
inner block that event handlers silently join. `withUnitOfWork` also demotes the
constraint-violation `DatabaseError` to a defect in one place, replacing the per-handler
`catchTag`. Its error channel surfaces the domain-language `PersistenceUnavailable` (transient
store outage → 503) and never the SQL-level `DatabaseError`.

The name is deliberately **not** `transactional`: "transactional" leaks the SQL-transaction
implementation that the unit-of-work abstraction exists to hide. The unit of work stays an
**application-layer** concern — it lives only in `commands/`, `event-handlers/`, and `platform/`,
never in `domain/` aggregates.

`UnitOfWork.run` remains the low-level primitive (the escape hatch, and what integration tests
drive directly); `withUnitOfWork` is the API use cases reach for. When a handler genuinely has
work that must stay _outside_ the transaction — external IO (a Stripe call), or a post-commit
email — it wraps only the transactional sub-block in `withUnitOfWork` and leaves the rest outside,
exactly as before.

### 2. Nested savepoints

A nested `run` now opens a real database **savepoint** on the ambient transaction instead of
flattening. A nested failure that the caller **catches** rolls back only to the savepoint, leaving
the outer unit of work free to commit; an **uncaught** nested failure propagates and rolls the
whole thing back, as it always did. This gives callers a per-call-site choice: is a
sub-operation's failure fatal to the whole unit of work, or recoverable? Flatten could only ever
answer "fatal."

### 3. Two buses, shared event base

A second bus, `IntegrationEventBus`, joins the in-fiber `DomainEventBus`. Both carry the **same**
`DomainEvent` base type — the bus a producer publishes to is the switch between consistency
models, not a distinct event type family.

- **`DomainEventBus` (immediate).** Subscribers run in-fiber, in the publisher's transaction, and
  a failure rolls the publisher back. Unchanged from ADR-0007. The right choice when two
  aggregates are one logical unit.
- **`IntegrationEventBus` (eventual).** `dispatch` does **not** run handlers. It appends the events
  to a `PostCommitBuffer` that the unit of work provides. The **outermost** `run` drains that
  buffer **after** its transaction commits — each handler in its own fresh transaction, its failure
  logged and isolated. The right default for new cross-aggregate reactions.

Subscriptions choose their bus in `interface/events/*-event-adapter.ts`: immediate reactions use
`DomainEventBus.subscribe`, eventual ones use `IntegrationEventBus.subscribe`. No existing handler
is forced to move; the choice is per handler. Default new cross-aggregate reactions to the
integration (eventual) bus.

### 4. Dispatch presumes a unit of work

Dispatching to _either_ bus outside a unit of work is a defect, and fails fast:

- `DomainEventBus.dispatch` asserts an ambient `TransactionContext`; absent → die. The in-fiber bus
  only makes sense inside the publisher's transaction.
- `IntegrationEventBus.dispatch` asserts an ambient `PostCommitBuffer`; absent → die. Without a
  buffer, the event would be silently dropped (nothing drains it).

Both almost always mean a forgotten `withUnitOfWork`. Failing loudly at dispatch is the safety net.

### 5. Failure-semantics asymmetry

The two buses fail in opposite directions, by design:

- A **bus-1** (immediate) handler failure propagates out of `dispatch`, out of the unit of work,
  and **rolls the publisher back**. Partial success is the bug class the immediate bus exists to
  prevent.
- A **bus-2** (integration) handler failure is **logged and swallowed**. The producer already
  committed; eventual consistency means the reaction's failure must not undo the trigger. Handlers
  are expected to be idempotent and independently retryable (retry machinery is a follow-up; see
  below).

### 6. Outermost-flush and savepoint-discard

- Only the **outermost** `run` provides the `PostCommitBuffer` and drains it. Nested runs inherit
  the ambient buffer.
- The flush happens **after** the outer transaction commits. If the transaction **rolls back**, the
  flush is skipped and the buffer is discarded — integration events from a rolled-back unit of work
  never fire.
- A **rolled-back savepoint** truncates the buffer back to its length on savepoint entry, so
  integration events emitted inside a nested savepoint that then rolled back are discarded too,
  while events from the surviving outer scope still flush.

## Consequences

- The transaction boundary reads at the use-case level. A reviewer sees `.pipe(withUnitOfWork)` and
  knows the whole handler body is one unit of work, without tracing an inner `uow.run` block.
- Eventual consistency is now expressible. Cross-aggregate reactions that should not be able to
  fail their trigger have a home, and "one aggregate per transaction" becomes the achievable
  default rather than aspirational.
- Nested units of work gain a recoverable-failure option via savepoints; auth's JIT-provision path
  keeps its all-or-nothing behavior because it lets the nested failure propagate.
- The in-memory flush is **lossy on a crash between commit and flush** — if the process dies after
  the transaction commits but before the buffer drains, those integration events are lost. This is
  accepted for now and documented; the durable replacement is the deferred outbox below.
- A forgotten `withUnitOfWork` is caught at dispatch (a defect) rather than producing a silently
  out-of-transaction subscriber run or a silently dropped integration event.

## Deferred: transactional outbox

The integration bus delivers the full conceptual model — separate transaction per handler, eventual
default, failure isolation — with no new table or relay, at the cost of being lossy on a
commit-then-crash. The durable upgrade is a **transactional outbox**: persist integration events to
a `platform.outbox` row in the _same_ transaction as the trigger, and a relay loop (poll +
advisory lock) reads the outbox and runs handlers idempotently, at least once.

Two constraints on that follow-up, noted here so they aren't rediscovered later:

- The relay must run in the **server runtime**, not the jobs deployable. Integration handlers are
  in-process functions registered on the bus; `@org/jobs` deliberately cannot import `@org/server`,
  so it cannot reach them.
- Handlers must be idempotent, because at-least-once delivery will re-run them.

## Alternatives considered

- **Extend the existing bus with an opt-in async mode.** Rejected for the same reason ADR-0007
  rejected a dual-mode bus: two delivery semantics in one component is confusing, and a subscriber
  shouldn't have to know whether it runs in- or out-of-transaction. Two buses with one shared event
  base keeps the switch explicit and at the publishing call site.
- **A distinct `IntegrationEvent` type family** (separate from `DomainEvent`). Rejected for now.
  The bus you publish to already encodes the consistency model; a parallel type hierarchy would
  double the event definitions without buying clarity. Revisitable if integration events diverge
  in shape from domain events.
- **Transactional outbox from day one.** Rejected as premature. The in-memory flush delivers the
  programming model today; the outbox is the right answer when durability across a
  commit-then-crash actually matters, and is cheaper to add once the two-bus shape is in place.
- **Keep flatten for nested runs.** Rejected. Flatten cannot express a recoverable sub-operation,
  and the database already supports savepoints; the only thing flatten saved was the savepoint
  bridge, which is a one-time cost.
- **Name the combinator `transactional`.** Rejected — it names the implementation (a SQL
  transaction), not the abstraction (a unit of work), and the whole point of the port is to keep
  the SQL out of the use-case vocabulary.

## Related

- ADR-0007 (unit of work + synchronous bus) — this ADR extends it; the immediate bus and its
  atomicity guarantees are unchanged.
- ADR-0003 (events as values) — both buses carry the same value-typed `DomainEvent`.
- ADR-0005 (repository pattern) — the per-call `TransactionContext` check is what makes savepoint
  and fresh-transaction joining automatic for repositories.
- ADR-0009 (testing) — the identity unit of work, recording event bus, and the integration tests
  that exercise the savepoint and post-commit-flush semantics.
