# ADR-0007: Unit of work, nested savepoints, and two-bus domain events

- Status: Accepted
- Date: 2026-04-24

> The unit of work was originally introduced as `TransactionRunner`; it was renamed to
> `UnitOfWork` and split into a port (`platform/ddd/ports/unit-of-work.ts`) + a Live
> (`platform/unit-of-work-live.ts`). The other DDD shared-kernel ports (`CommandBus`, `QueryBus`,
> `DomainEventBus`, `IntegrationEventBus`, `DomainEvent`, `SpanAttributesExtractor`) received the
> same port/Live split; their Lives are `command-bus-live.ts`, `query-bus-live.ts`,
> `domain-event-bus-live.ts`, and `integration-event-bus-live.ts` in `platform/`.

## Context and Problem Statement

A domain event published by one aggregate can require a write to another. The canonical example: creating an organization emits an `OrganizationCreated` event; the wallet module subscribes and creates a wallet for the new organization. Two aggregates, two writes, one logical operation.

The architectural question is: when do those writes commit, and what happens when one of them fails? Two coherent answers exist:

- **Immediately consistent.** Both writes participate in the same database transaction. Either both commit or both roll back. The wallet creation is part of the organization creation as far as the database is concerned.
- **Eventually consistent.** The first write commits, an event is recorded, and a separate fiber (or process) consumes the event and performs the second write afterward. The second write may fail and be retried; the system is briefly in a state where the first aggregate exists without the second.

Both have legitimate uses, and this codebase needs **both**:

- Immediate consistency for multi-aggregate operations that are conceptually a single unit of work — a wallet must not exist without an organization, and either both writes commit or neither does.
- Eventual consistency for cross-aggregate _reactions_ — "send a welcome email," "sync a read model," "cancel the subscription when the org is deleted." DDD guidance (one aggregate per transaction; eventual consistency _between_ aggregates) makes eventual the sensible default for new cross-aggregate work. These reactions want to run _after_ the trigger commits, in their own transaction, and must never undo the trigger if they fail.

There is a subtler implementation hazard for the immediate case. If the event bus delivers via fan-out (subscribers run in forked fibers), the subscribers do not run in the publisher's fiber and do not inherit its context. Even if the publisher opened a transaction, the subscriber's repository call uses a fresh pool connection, _outside_ the transaction. The result is eventual consistency _by accident_, without any of the durability guarantees proper eventual consistency requires.

Two further concerns shape the design:

- **Boundary legibility.** The transaction is a property of the whole use case, not an implementation detail buried mid-function. It should be declared once, visibly, at the use-case boundary — not as an inner block that synchronously-dispatched event handlers silently join.
- **Nested recoverability.** A unit of work nested inside another (e.g. auth's just-in-time sign-in firing the user module's create command) should be able to fail and be _caught_ without aborting the outer transaction, when the caller wants that.

## Decision

Two collaborating platform services — `UnitOfWork` and a pair of domain-event buses (`DomainEventBus`, `IntegrationEventBus`) — plus a use-case-facing `withUnitOfWork` combinator. All are exposed as ports under `platform/ddd/`; production Lives live in sibling `platform/*-live.ts` files and are wired only at the composition root.

### UnitOfWork and the `withUnitOfWork` boundary

`UnitOfWork.run` is the low-level primitive: it opens a transaction, provides a `TransactionContext` to the inner effect (so repository calls join it via the database's per-call `makeQuery` check), and rolls back if anything inside fails. Its error channel surfaces `DatabaseError` (constraint violations) and the domain-language `PersistenceUnavailable` (transient store outage), never the raw `@org/database` signal.

Use cases don't call `run` directly; they apply the **`withUnitOfWork`** combinator at the end of the handler's pipe, the way Cosmic-Python writes `with uow:` at the top of a handler:

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

The transaction is declared once, visibly, at the boundary. `withUnitOfWork` also demotes the constraint-violation `DatabaseError` to a defect in one place (replacing a per-handler `catchTag`) and surfaces only `PersistenceUnavailable`. It is named `withUnitOfWork`, deliberately **not** `transactional`: "transactional" leaks the SQL-transaction implementation the abstraction exists to hide. The unit of work stays an **application-layer** concern — it lives only in `commands/`, `event-handlers/`, and `platform/`, never in `domain/` aggregates.

`UnitOfWork.run` remains the escape hatch: integration tests drive it directly, and a handler with work that must stay _outside_ the transaction (external IO like a Stripe call, or a post-commit email) wraps only the transactional sub-block in `withUnitOfWork` and leaves the rest outside.

A test-only identity implementation (`IdentityUnitOfWork` in `test-utils/`) makes `run` a pass-through: the inner effect runs as-is, no transaction is opened. Fake repositories don't consult `TransactionContext`, so use cases depend on this port — not on `Database` — and unit-test without a database (`lives-only-from-composition-roots` keeps that enforceable in the dep graph).

### Nested savepoints

`run` is re-entrant. A bare (top-level) call opens a real `db.transaction`. A nested call (a `TransactionContext` already in scope) opens a real **savepoint** on the ambient transaction. A nested failure that the caller **catches** rolls back only to the savepoint, leaving the outer unit of work free to commit; an **uncaught** nested failure propagates and rolls the whole thing back. This gives callers a per-call-site choice — is a sub-operation's failure fatal to the whole unit of work, or recoverable? — that a flatten-into-parent strategy could not express.

### DomainEventBus — immediate, in-fiber

The in-fiber bus is a synchronous registry. `subscribe(eventSchema, handler)` registers a handler under the schema's tag at Layer construction time. `dispatch(events)` runs each event's handlers, in registration order, in the publisher's fiber:

```ts
const dispatch: DomainEventBusShape["dispatch"] = (events) =>
  Effect.gen(function* () {
    // Dispatch presumes a unit of work: the in-fiber bus only makes sense
    // inside the publisher's transaction. Absent → defect (see below).
    const map = yield* Ref.get(handlers);
    for (const event of events) {
      for (const handler of map.get(event._tag) ?? []) {
        yield* handler(event);
      }
    }
  });
```

Because handlers run in the publisher's fiber, they inherit `TransactionContext`: a subscriber's write joins the publisher's transaction, and a subscriber's failure propagates out of `dispatch`, up through the unit of work, and rolls the transaction back. This is the right bus when two aggregates are one logical unit.

### IntegrationEventBus — eventual, post-commit

The integration bus carries the **same** `DomainEvent` base type as the in-fiber bus — the bus a producer publishes to is the switch between consistency models, not a distinct event type family. Its `dispatch` does **not** run handlers; it appends the events to a `PostCommitBuffer` that the unit of work provides. The **outermost** `run` drains that buffer **after** its transaction commits — each handler in its own fresh transaction, its failure logged and isolated. This is the default for new cross-aggregate reactions.

Subscriptions choose their bus in `interface/events/*-event-adapter.ts`: immediate reactions use `DomainEventBus.subscribe`, eventual ones use `IntegrationEventBus.subscribe`. The choice is per handler; default new cross-aggregate reactions to the integration (eventual) bus.

### Dispatch presumes a unit of work

Dispatching to _either_ bus outside a unit of work is a defect, and fails fast:

- `DomainEventBus.dispatch` asserts an ambient `TransactionContext`; absent → die.
- `IntegrationEventBus.dispatch` asserts an ambient `PostCommitBuffer`; absent → die (without a buffer the event would be silently dropped — nothing drains it).

Both almost always mean a forgotten `withUnitOfWork`. Failing loudly at dispatch is the safety net.

### Failure-semantics asymmetry

The two buses fail in opposite directions, by design:

- A **DomainEventBus** (immediate) handler failure propagates out of `dispatch`, out of the unit of work, and **rolls the publisher back**. Partial success is the bug class this bus exists to prevent. A subscriber that legitimately wants to swallow a known error does so explicitly via `Effect.catchTag` in its own subscription closure.
- An **IntegrationEventBus** (eventual) handler failure is **logged and swallowed**. The producer already committed; the reaction's failure must not undo the trigger. Handlers are expected to be idempotent and independently retryable.

### Outermost-flush and savepoint-discard

- Only the **outermost** `run` provides the `PostCommitBuffer` and drains it. Nested runs inherit the ambient buffer.
- The flush happens **after** the outer transaction commits. If the transaction **rolls back**, the flush is skipped and the buffer is discarded — integration events from a rolled-back unit of work never fire.
- A **rolled-back savepoint** truncates the buffer back to its length on savepoint entry, so integration events emitted inside a nested savepoint that then rolled back are discarded, while events from the surviving outer scope still flush.

## Consequences

- Multi-aggregate writes triggered by immediate domain events are atomic: every aggregate in a logical unit of work commits, or none does. A subscriber's failure aborts the publisher's command — the correct behavior given the goal.
- Eventual consistency is expressible. Cross-aggregate reactions that must not be able to fail their trigger have a home, and "one aggregate per transaction" becomes the achievable default.
- The transaction boundary reads at the use-case level: a reviewer sees `.pipe(withUnitOfWork)` and knows the whole handler body is one unit of work.
- Nested units of work gain a recoverable-failure option via savepoints; flows that want all-or-nothing simply let the nested failure propagate.
- A forgotten `withUnitOfWork` is caught at dispatch (a defect) rather than producing an out-of-transaction subscriber run or a silently dropped integration event.
- Slow immediate subscribers slow their publishers — accepted, since they are part of the same logical operation.
- Use-case unit tests don't need a database: the identity unit of work makes `run` a pass-through and fake repositories ignore `TransactionContext`.
- The in-memory integration flush is **lossy on a crash between commit and flush** — if the process dies after the transaction commits but before the buffer drains, those integration events are lost. Accepted for now; the durable replacement is the deferred outbox below. (A similar at-most-once window exists for the immediate bus on process death between commit and HTTP response; mitigated by idempotent subscribers and deterministic upstream ids.)

## Deferred: transactional outbox

The integration bus delivers the full conceptual model — separate transaction per handler, eventual default, failure isolation — with no new table or relay, at the cost of being lossy on a commit-then-crash. The durable upgrade is a **transactional outbox**: persist integration events to a `platform.outbox` row in the _same_ transaction as the trigger, and a relay loop (poll + advisory lock) reads the outbox and runs handlers idempotently, at least once. Two constraints on that follow-up:

- The relay must run in the **server runtime**, not the jobs deployable — integration handlers are in-process functions registered on the bus, and `@org/jobs` deliberately cannot import `@org/server`.
- Handlers must be idempotent, because at-least-once delivery will re-run them.

## Anti-corruption layer for cross-module event consumption

When a module subscribes to another module's domain event, that event's schema becomes load-bearing for the subscriber. A new field on `OrganizationCreated` is harmless to organization's internal callers; it can break the wallet handler if that handler reads field names off the event directly.

To keep the publisher's event schema from leaking into the consumer's handlers, cross-module subscriptions go through an **adapter** file. The adapter is an inbound port — structurally identical to an HTTP endpoint, just on the event-bus transport — so it lives in `interface/events/`, the only place allowed to import the publisher's barrel. Handlers stay in `event-handlers/` and consume a consumer-internal trigger type instead.

```
modules/<consumer>/
├── interface/
│   └── events/
│       └── <publisher>-event-adapter.ts     # subscribes to publisher events (inbound port)
└── event-handlers/
    ├── triggers/
    │   └── <publisher>-events.ts            # consumer-internal trigger types
    └── <name>-when-<...>.ts                 # handler — imports the trigger type
```

The adapter subscribes (to whichever bus fits the consistency model), translates the event into the consumer's trigger shape, and forwards to the handler:

```ts
const toTrigger = (event: OrganizationCreated): OrganizationCreatedTrigger => ({
  organizationId: event.organizationId,
});

export const OrganizationEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const bus = yield* DomainEventBus; // immediate: wallet must exist in the same tx
    const repo = yield* WalletRepository;
    yield* bus.subscribe(OrganizationCreated, (event) =>
      handleOrganizationCreated(toTrigger(event)).pipe(
        Effect.provideService(WalletRepository, repo),
      ),
    );
  }),
);
```

The handler depends only on the trigger type — never on `OrganizationCreated`. If organization adds a field, only the adapter changes. The pattern is enforced by the `event-handlers-isolation` dep-cruiser rule, which forbids `event-handlers/` from importing other modules' barrels; the adapter in `interface/events/` is the permitted inbound-adapter layer. This is Vernon's anti-corruption layer at module scope — one file per (consumer, publisher) pair plus one trigger-types file.

## Alternatives considered

- **One dual-mode bus** (synchronous and asynchronous delivery, opt-in per subscriber). Rejected. Two delivery semantics in one component is confusing; a subscriber shouldn't have to know whether it runs in- or out-of-transaction. Two buses with one shared event base keeps the switch explicit and at the publishing call site.
- **A distinct `IntegrationEvent` type family.** Rejected for now — the bus a producer publishes to already encodes the consistency model; a parallel type hierarchy would double the event definitions without buying clarity.
- **Pub/sub-backed immediate bus with forked subscribers.** Rejected — the delivery model precludes the subscriber inheriting `TransactionContext` from the publisher, which is exactly the property the immediate bus needs.
- **Skip the unit-of-work abstraction; open transactions directly in use cases.** Rejected — it forces use cases to depend on the database service, which the unit-test fakes don't provide.
- **Flatten nested runs into the parent transaction.** Rejected — flatten cannot express a recoverable sub-operation, and the database already supports savepoints.
- **Fail-soft immediate subscribers** (a failed subscriber logs and the publisher commits anyway). Rejected — that is the partial-failure-with-logged-silence behavior the immediate bus exists to prevent. Reactions that _should_ tolerate failure belong on the integration bus.
- **Transactional outbox from day one.** Rejected as premature — the in-memory flush delivers the programming model today; the outbox is the right answer when durability across a commit-then-crash matters, and is cheaper to add once the two-bus shape is in place.

## Related

- ADR-0003 (events as values) — both buses carry the same value-typed `DomainEvent`.
- ADR-0005 (repository pattern) — the per-call `TransactionContext` check is what makes transaction and savepoint joining automatic for repositories.
- ADR-0009 (testing) — the identity unit of work, recording event bus, and the integration tests that exercise the savepoint and post-commit-flush semantics.
