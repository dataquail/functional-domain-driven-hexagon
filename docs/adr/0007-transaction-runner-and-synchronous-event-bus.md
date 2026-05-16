# ADR-0007: TransactionRunner + synchronous DomainEventBus

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

A domain event published by one aggregate can require a write to another. The canonical example: creating a user emits a `UserCreated` event; a wallet module subscribes to that event and creates a wallet for the new user. Two aggregates, two writes, one logical operation.

The architectural question is: when do those writes commit, and what happens when one of them fails?

Two coherent answers exist:

- **Immediately consistent.** Both writes participate in the same database transaction. Either both commit or both roll back. The wallet creation is part of the user creation as far as the database is concerned.
- **Eventually consistent.** The user write commits first, an event is durably recorded, and a separate process (or fiber) consumes the event and performs the wallet write later. The wallet write may fail and require retry; the system is briefly in a state where the user exists without a wallet.

Both have legitimate use cases. Eventual consistency is the right choice for cross-process integration, where the subscriber lives in another service and the publisher must not block on it. Immediate consistency is the right choice for _within-process_ multi-aggregate operations that are conceptually a single unit of work.

This codebase needs immediate consistency for its in-process domain events: a wallet must not exist without a user, a user must not exist without a wallet, and either both writes commit or neither does. We do not need eventual consistency for any current feature.

There is a subtler implementation hazard. If the event bus delivers events to subscribers via fan-out (e.g. a pub/sub primitive that runs subscribers in forked fibers), the subscribers do not run in the publisher's fiber. They do not inherit the publisher's context. Even if the publisher has opened a transaction, the subscriber's repository call will not see it — it will use a fresh connection from the pool, outside the transaction. The result is eventual consistency _by accident_, not by design, and without any of the durability guarantees that proper eventual consistency requires.

## Decision

Two collaborating platform services: `TransactionRunner` and a synchronous `DomainEventBus`.

### TransactionRunner

A platform service exposing one method:

```ts
readonly run: <A, E, R>(
  effect: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E | DatabaseError, Exclude<R, TransactionContext>>;
```

The production implementation calls the database's `transaction` primitive, which provides a `TransactionContext` to the inner effect. Repositories use the database's `makeQuery` helper, which checks for an active `TransactionContext` per call; in scope of `run`, every repository call automatically joins the active transaction. Outside `run`, repository calls fall back to the connection pool's default execute path (auto-commit per query).

A test-only identity implementation makes `run` the identity function. The inner effect runs as-is; no transaction is opened, no `TransactionContext` is provided. Fake repositories don't consult `TransactionContext`, so the identity runner is a faithful pass-through for unit tests.

### DomainEventBus

The bus is a synchronous in-fiber registry. `subscribe(eventSchema, handler)` registers a handler under the schema's tag at Layer construction time. `dispatch(events)` runs each event's registered handlers, in registration order, in the publisher's fiber:

```ts
const dispatch: DomainEventBusShape["dispatch"] = (events) =>
  Effect.gen(function* () {
    const map = yield* Ref.get(handlers);
    for (const event of events) {
      const list = map.get(event._tag) ?? [];
      for (const handler of list) {
        yield* handler(event);
      }
    }
  });
```

Because handlers run in the publisher's fiber, they inherit `TransactionContext`. A subscriber's repository write joins the publisher's transaction. A subscriber's failure propagates back through `dispatch`, then up through `tx.run`, which causes the database transaction to roll back.

### Use-case shape

A use case that produces events wraps the persistence + dispatch step in `tx.run`:

```ts
export const createUser = (cmd: CreateUserCommand) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const tx = yield* TransactionRunner;
    // ... build the next state and the events purely ...
    yield* tx.run(
      Effect.gen(function* () {
        yield* repo.insert(user);
        yield* bus.dispatch(events);
      }),
    );
    return user.id;
  });
```

### Non-goals

The bus is **in-process only**.

- No outbox table.
- No async fan-out.
- No integration-event mechanism for cross-service eventually-consistent delivery.

These are valid patterns but solve a different problem. If a future feature genuinely needs cross-process eventual consistency, the right move is to add a _separate_ mechanism — most likely an outbox table populated in the same transaction as the originating write, plus an external publisher that reads the outbox and ships events to a message broker. Don't extend this bus to do double duty.

## Consequences

- Multi-aggregate writes triggered by domain events are atomic. Either every aggregate involved in a logical unit of work commits, or none of them does.
- A subscriber's failure aborts the publisher's command. This is the price of immediate consistency, and is the correct behavior given the goal: a partial success in this model is exactly the bug class the design exists to prevent.
- A subscriber that legitimately wants to swallow specific known errors does so explicitly, via `Effect.catchTag` in its own subscription closure. Catching errors is a deliberate, narrow act per subscriber, not a default.
- Slow subscribers slow their publishers. Real, accepted: subscribers participating in the same transaction are part of the same logical operation; their cost is paid by the originating request.
- Use-case unit tests don't need a real database. The identity transaction runner makes `tx.run(effect)` equivalent to running the effect, and fake repositories don't consult `TransactionContext`.
- A short window of risk exists if the database commits and the publishing fiber is killed before returning a response (process death, OS signal, network drop). The wallet write commits but the HTTP client retries and triggers a duplicate. Mitigated by (a) idempotency catches in subscribers (e.g. tolerating "wallet already exists for user" as a no-op), (b) deterministic ids generated upstream of the transaction so retries hit the same row, and (c) at-most-once dispatch — but not eliminated.
- The design implies one bus for all in-process domain events. There is no per-subscriber escape hatch to "make this one async." If you find yourself wanting one, that's the signal that you actually want the outbox pattern, and the right response is to build it as a separate mechanism rather than complicate the in-process bus.

## Alternatives considered

- **Dual-mode bus** (synchronous and asynchronous delivery, opt-in per subscriber). Rejected. Two delivery semantics in one component is confusing; subscribers shouldn't have to know whether they're in-transaction or out-of-transaction handlers, and the asynchronous mode would carry its own atomicity hazards.
- **Pub/sub-backed bus with forked subscribers**. Rejected — the delivery model precludes the subscriber inheriting `TransactionContext` from the publisher, which is exactly the property we need for atomicity.
- **Skip the runner abstraction; use cases open transactions directly.** That forces use cases to depend on the database service. The unit-test fakes don't provide it, so the use case becomes harder to test in isolation. The runner is a thin shim, but it lets the use-case dependency surface stay clean.
- **Fail-soft subscribers** (a failed subscriber logs and continues, the publisher's transaction commits anyway). Rejected. Immediate consistency is the goal; fail-soft is exactly the partial-failure-with-logged-silence behavior we're trying to prevent.
- **Outbox from day one.** Rejected. Adds machinery (a table, a publisher process, retry semantics, dedup) for a problem we don't have. When the problem appears, the outbox is the right answer; today, it would be speculative complexity.

## Anti-corruption layer for cross-module event consumption

When a module subscribes to another module's domain event, that event's schema becomes load-bearing for the subscriber. A new field on `UserCreated` is harmless to `user`'s internal callers; it can be a breaking change for `wallet` if `wallet`'s handler reads field names off the event directly.

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

The adapter subscribes to each publisher event, translates it into the consumer's trigger shape, and forwards to the handler:

```ts
const toTrigger = (event: UserCreated): UserCreatedTrigger => ({ userId: event.userId });

export const UserEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const bus = yield* DomainEventBus;
    const repo = yield* WalletRepository;
    yield* bus.subscribe(UserCreated, (event) =>
      handleUserCreated(toTrigger(event)).pipe(Effect.provideService(WalletRepository, repo)),
    );
  }),
);
```

The handler depends only on the trigger type — never on `UserCreated`. If `user` adds a field, only the adapter changes; handlers stay stable.

The pattern is enforced by the `event-handlers-isolation` dep-cruiser rule, which forbids `event-handlers/` from importing other modules' barrels at all. The adapter lives in `interface/events/`, which (like `interface/http/`) is permitted to import other modules' barrels — that's the inbound-adapter layer's job.

This is Vernon's anti-corruption layer at module scope. It costs one file per (consumer, publisher) pair and one trigger-types file. The benefit is that the consumer's handler logic remains testable, stable, and decoupled from the publisher's evolving schema.

## Related

- ADR-0003 (events as values) — the events arriving at `dispatch` come from pure aggregate ops.
- ADR-0005 (repository pattern) — the live repository's per-call `TransactionContext` check is what makes transaction joining automatic.
- ADR-0009 (testing) — the identity runner and recording event bus are how unit tests use this pattern.
