# ADR-0007: Unit of work, nested savepoints, and two-bus domain events

- Status: Accepted
- Date: 2026-04-24

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

Two collaborating services — `UnitOfWork` and a single `DomainEventBus` — plus a use-case-facing `withUnitOfWork` combinator. **The bus offers both consistency models, and a subscription chooses between them.**

These live in the CQRS package (ADR-0006), not in the application. The boundary's _semantics_ — re-entrancy, post-commit buffering, flush ordering, failure isolation — are the same wherever it runs; only the SQL is ours. What the application supplies is a `TransactionDriver`: open a scope, open a nested scope, say whether one is already open. The slonik binding for it is the one file that knows a unit of work is implemented as a database transaction, and it is wired at the composition root.

Two consequences of that split are worth recording because both were load-bearing and neither is obvious.

The port's requirement channel is **unchanged** by `run`. An earlier shape excluded the database's transaction-context service from it, on the assumption that callers composed effects requiring one. They do not: repository reads resolve the ambient scope optionally, so it never appears in a caller's requirements, and the exclusion was an artifact of the internals leaking outward. The adapter's own internals still narrow it, which is assignable to a port promising `R` untouched because a requirement channel is covariant.

The port's error channel names `TransactionFailed`, not the database's own error. By the time an effect reaches the boundary a repository has already translated its constraint violations into domain errors; what is left is the boundary itself failing, which no use case can act on. `withUnitOfWork` demotes it to a defect in one place, so a use case still sees only `PersistenceUnavailable` — the same type it saw before, for a better-named reason.

### UnitOfWork and the `withUnitOfWork` boundary

`UnitOfWork.run` is the low-level primitive: it opens a transaction, provides a `TransactionContext` to the inner effect (so repository calls and query-handler reads join it via the database's per-call `makeQuery` check), and rolls back if anything inside fails. Its error channel surfaces `DatabaseError` (constraint violations) and the domain-language `PersistenceUnavailable` (transient store outage), never the raw `@org/database` signal.

This is why use-case DB access — repositories and read-side query handlers alike — goes through the transaction-aware `makeQuery`, never the bare pool `execute`. A read dispatched inside a unit of work (a CQRS query is not confined to request-time reads: a policy/ACL query is resolved during a command's authorization, inside its transaction) must join the ambient transaction, or it runs on a foreign pool connection and fails. A lint rule enforces `makeQuery` over bare `execute` across commands and queries; bare `execute` is reserved for test seeding and background jobs, which run outside any unit of work.

Use cases don't call `run` directly; they apply the **`withUnitOfWork`** combinator at the end of the handler's pipe, the way Cosmic-Python writes `with uow:` at the top of a handler:

```ts
export const createUserHandler = (cmd: CreateUserPayload) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    // ... build the next state and the events purely ...
    yield* repo.insert(user);
    yield* bus.dispatch(events);
    return user.id;
  }).pipe(withUnitOfWork);
```

The transaction is declared once, visibly, at the boundary. `withUnitOfWork` also demotes the constraint-violation `DatabaseError` to a defect in one place (replacing a per-handler `catchTag`) and surfaces only `PersistenceUnavailable`. It is named `withUnitOfWork`, deliberately **not** `transactional`: "transactional" leaks the SQL-transaction implementation the abstraction exists to hide. The unit of work stays an **application-layer** concern — it lives only in `commands/` and `platform/`, never in `domain/` aggregates.

`UnitOfWork.run` remains the escape hatch: integration tests drive it directly, and a handler with work that must stay _outside_ the transaction (external IO like a Stripe call, or a post-commit email) wraps only the transactional sub-block in `withUnitOfWork` and leaves the rest outside.

A pass-through implementation (`PassThroughUnitOfWork`, from the unit-of-work package's `testing` entry point) runs the inner effect as-is over an in-memory driver: no transaction is opened. Fake repositories don't consult `TransactionContext`, so use cases depend on this port — not on `Database` — and unit-test without a database (`lives-only-from-composition-roots` keeps that enforceable in the dep graph). It is the real boundary over a fake driver rather than a hand-rolled identity function, which is what makes a unit test see the same re-entrancy, the same after-commit ordering, and the same discard-on-rollback that production gets.

### Nested savepoints

`run` is re-entrant. A bare (top-level) call opens a real `db.transaction`. A nested call (a `TransactionContext` already in scope) opens a real **savepoint** on the ambient transaction. A nested failure that the caller **catches** rolls back only to the savepoint, leaving the outer unit of work free to commit; an **uncaught** nested failure propagates and rolls the whole thing back. This gives callers a per-call-site choice — is a sub-operation's failure fatal to the whole unit of work, or recoverable? — that a flatten-into-parent strategy could not express.

### One bus; the subscription picks the consistency model

A producer knows what happened. It does not know who is listening, and under ADR-0022 it is frequently forbidden to: the organization module must not know the wallet module exists. An earlier design gave each consistency model its own bus, which put the choice on `dispatch` — so a producer decided, on behalf of consumers it could not name, whether their failure could undo its own write. Organization picked immediate consistency for wallet without knowing wallet was there.

So `dispatch` says only that the events happened, and each subscriber declares what it needs:

| surface                | when                                            | transaction              | a handler's failure      |
| ---------------------- | ----------------------------------------------- | ------------------------ | ------------------------ |
| `subscribe`            | in the publisher's fiber, in registration order | inherits the publisher's | rolls the publisher back |
| `subscribeAfterCommit` | once the outermost unit of work commits         | a fresh one per handler  | logged and isolated      |
| `stream`               | same as after-commit, but never awaited         | none — its own fiber     | reported; see sagas      |

One event can therefore serve consumers that need different things — a wallet that must be atomic with its organization, and a welcome email that must not be — which two buses could only express by dispatching the same event twice.

`subscribe(eventSchema, handler)` registers under the schema's tag at Layer construction time. `dispatch(events)` hands the events to whatever owns the boundary, then runs the immediate handlers in the publisher's fiber:

```ts
const dispatch: DomainEventBusShape["dispatch"] = (events) =>
  Effect.gen(function* () {
    // Handed over first. The unit of work's sink dies here if no scope is
    // open (see below); a host with no sink installed drains at the end.
    const sink = yield* Effect.serviceOption(DeferralSink);
    if (Option.isSome(sink)) yield* sink.value.defer(events);

    const map = yield* Ref.get(immediate);
    for (const event of events) {
      for (const handler of map.get(event._tag) ?? []) {
        yield* handler(event);
      }
    }
  });
```

Because immediate handlers run in the publisher's fiber, they inherit `TransactionContext`: a subscriber's write joins the publisher's transaction, and its failure propagates out of `dispatch`, up through the unit of work, and rolls the transaction back. That is the right surface when two aggregates are one logical unit.

Everything is handed over, unconditionally, and **before** the first immediate handler runs. A dispatch that forgot its boundary is therefore reported while it is still whole rather than after half of it has executed, and nothing is lost by taking the events early: a boundary that does not succeed never drains what it took. The **outermost** `run` drains what it holds **after** its transaction commits, each after-commit handler through its own `run`, so each gets a fresh transaction and its own scope with its failure isolated. Giving a handler its own scope rather than a bare transaction is what lets a reaction publish events of its own; it also means a cycle among reactions would loop, which is inherent to any at-least-once relay and is the author's to avoid.

Subscriptions are declared in `interface/events/*.event-adapter.ts`. Default new cross-aggregate reactions to `subscribeAfterCommit`; reserve `subscribe` for the case where the reaction genuinely must be able to abort its trigger.

**Positional dispatch was rejected.** Dispatching after the `withUnitOfWork` block, rather than inside it, would also run a reaction post-commit and needs no second surface. It was not taken: the subscriber then runs in the command handler's fiber, so its failure surfaces as the failure of a command whose write already committed — the inversion after-commit delivery exists to prevent. It also leaves sagas without a source, and makes the consistency model a property of where a line sits in a function body, invisible in the type and silently changed by moving it.

### Dispatch presumes a unit of work

Dispatching outside a unit of work is a defect, and fails fast.

`dispatch` hands its events to an ambient deferral sink before any handler runs, and the unit of work's sink asserts an open `UnitOfWorkScope`; absent → die. Its presence _is_ the answer to "am I inside a unit of work". The assertion sits in the sink rather than in the bus because "there must be a transaction" is the boundary's opinion and not the bus's — but this application installs the boundary, so the guarantee at every dispatch site is the same one described here. The bus previously asked the database whether a transaction was open — a unit-of-work question answered by the wrong service, and the reason the bus knew about SQL at all.

Absent a scope the alternatives are worse than a defect: immediate subscribers would run with no transaction to inherit, and after-commit ones would buffer onto nothing.

Both almost always mean a forgotten `withUnitOfWork`. Failing loudly at dispatch is the safety net.

### Failure-semantics asymmetry

The two subscription surfaces fail in opposite directions, by design:

- A **`subscribe`** handler's failure propagates out of `dispatch`, out of the unit of work, and **rolls the publisher back**. Partial success is the bug class that surface exists to prevent. A subscriber that legitimately wants to swallow a known error does so explicitly via `Effect.catchTag` in its own subscription closure.
- A **`subscribeAfterCommit`** handler's failure is **isolated**. The producer already committed; the reaction's failure must not undo the trigger. Handlers are expected to be idempotent and independently retryable.

That isolation leaves the failure nowhere to surface — the dispatching fiber finished long ago — so it is logged _and_ reported to an `UnhandledFailures` surface carrying the source, the event, and the cause. A log line is something nothing can alert on and no test can assert against; this is the programmatic record. It is resolved from ambient context and optional, so a host that wires none keeps the behavior it had.

### Outermost-flush and savepoint-discard

- Only the **outermost** `run` opens a fresh `UnitOfWorkScope` and drains it. Nested runs inherit the enclosing one.
- The flush happens **after** the outer transaction commits. If the transaction **rolls back**, the flush is skipped and the buffer is discarded — after-commit reactions to a rolled-back unit of work never fire.
- A **rolled-back savepoint** truncates the buffer back to its length on savepoint entry, so after-commit reactions to events emitted inside a nested savepoint that then rolled back are discarded, while events from the surviving outer scope still flush.

### Process managers over after-commit events

An event adapter translates one event into one command. Some reactions need more: they wait for a _combination_ of events, time one out, and compensate when a later step fails. That is a process manager, and it gets its own stereotype — a `sagas/` folder beside the others, with its own isolation rule (ADR-0002 and ADR-0008 reserved it).

A saga declares the events it watches and receives them as a stream. Two properties matter more than the API.

**It cannot inherit a publisher's transaction.** The runner forks each saga from its own layer's scope, so the fiber's context is the one the layer was built with and a publisher's scope is not in its ancestry. Nothing has to be scrubbed, so nothing can be forgotten. Each command a saga dispatches opens its own unit of work. This is not a limitation being worked around — holding one transaction open across a process that waits for a payment is precisely what sagas exist to avoid, which is why they trade atomicity for compensation.

**A slow saga cannot hold up a flush.** Stream consumers are published to and not awaited, where `subscribeAfterCommit` handlers are awaited and isolated. Those are two registration surfaces rather than one with a flag, because the delivery contracts genuinely differ. Subscription happens when the runner's layer is built, not lazily on first pull, so a saga cannot miss what the first unit of work to commit after boot published.

A saga's `run` may not fail. A process manager that ends in an unhandled error has no one to report to, so the compensating action is part of its job; an empty error channel forces that decision rather than deferring it. Interruption is not reported as a failure — every saga fiber is interrupted at shutdown, and announcing each one as broken on every clean stop is the noise that trains people to ignore the channel.

**Delivery is in-memory and lossy across a restart.** A saga's state lives in the fiber running it, and its events arrive over a subscription with no replay, so a process death loses whatever was in flight. That is the same durability boundary after-commit delivery already has, and the deferred outbox below closes both at once. Until then, keep a saga's decisions idempotent.

Reach for an adapter first. A saga earns its state only when no single event decides the outcome.

### Split from the CQRS package (since published)

The unit of work shipped inside the CQRS library at first, and that was one decision too many for a message bus to be making. `dispatch` died without an open scope, so publishing an event at all required a transaction, and the bus exposed its buffer-and-flush plumbing purely so the boundary could drive it — a transaction-shaped interface imposed on consumers who had never asked about consistency models.

The boundary now lives in `@effect-server-utils/unit-of-work`, at an exact beta, and the one edge that carried the opinion was cut down to a `DeferralSink`: an optional service with a single method, which takes ownership of a dispatch's deferred events and promises to drain them later. It names no transaction, no savepoint, and no connection. Absent a sink the bus runs those handlers itself at the end of the dispatch — still after every immediate one, still isolated — so a handler written against `subscribeAfterCommit` is correct in both wirings, and a host can adopt a unit of work later without revisiting one of them. Installing the boundary is what makes "after commit" mean after _this_ commit, and installing it is what this application does: the layer that builds the unit of work builds the sink with it, so everything above still holds here.

Two things improved on the way. The sink resolves the bus at defer time and buffers a closed-over drain rather than the bare events, so a bus wired deeper than the boundary is still the bus that gets drained — the old shape looked one up at commit time, found none, and logged the events as dropped. And the package's `testing` entry point ships the pass-through boundary and the in-memory drivers, which is the double a consumer would otherwise hand-roll and get wrong on rollback.

## Consequences

- Multi-aggregate writes triggered by immediate domain events are atomic: every aggregate in a logical unit of work commits, or none does. A subscriber's failure aborts the publisher's command — the correct behavior given the goal.
- Eventual consistency is expressible. Cross-aggregate reactions that must not be able to fail their trigger have a home, and "one aggregate per transaction" becomes the achievable default.
- The transaction boundary reads at the use-case level: a reviewer sees `.pipe(withUnitOfWork)` and knows the whole handler body is one unit of work.
- Nested units of work gain a recoverable-failure option via savepoints; flows that want all-or-nothing simply let the nested failure propagate.
- A forgotten `withUnitOfWork` is caught at dispatch (a defect) rather than producing an out-of-transaction subscriber run or a silently dropped after-commit reaction.
- Slow immediate subscribers slow their publishers — accepted, since they are part of the same logical operation.
- Use-case unit tests don't need a database: the pass-through unit of work runs over an in-memory driver and fake repositories ignore `TransactionContext`.
- The in-memory flush is **lossy on a crash between commit and flush** — if the process dies after the transaction commits but before the buffer drains, those after-commit reactions are lost. Accepted for now; the durable replacement is the deferred outbox below. (A similar at-most-once window exists for immediate subscribers on process death between commit and HTTP response; mitigated by idempotent subscribers and deterministic upstream ids.)

## Deferred: transactional outbox and durable process managers

After-commit delivery gives the full conceptual model — separate transaction per handler, eventual default, failure isolation — with no new table or relay, at the cost of being lossy on a commit-then-crash. Process managers sit on the same boundary. The durable upgrade closes both.

**The outbox.** Persist after-commit events to a `platform.outbox` row in the _same_ transaction as the trigger — the insert replaces the in-memory buffer append — and have a relay loop (poll plus advisory lock) read it and run handlers at least once. Two constraints carry over: the relay must run in the **server runtime**, not the jobs deployable, because after-commit handlers are in-process functions registered on the bus; and handlers must be idempotent, because at-least-once means they will re-run.

**Durable process managers.** The crux is that an in-memory timeout dies with the process while a `timeout_at` column survives. A saga instance table keyed by saga name and correlation id, holding its state and its next deadline, lets the runner rehydrate open instances at boot and re-arm their timers. Saga bodies do not change: the stream surface stays the API, only its _source_ moves from an in-memory subscription to the outbox, plus rehydration. That is what makes deferring this cheap rather than a rewrite.

**Idempotency deserves a mechanism, not an expectation.** "Handlers are expected to be idempotent" is what this ADR says today, and nothing enforces or assists it. At-least-once delivery makes it mandatory. Prior art worth copying — a small Effect CQRS sample by Patrick Roza does exactly this — is a command receipt keyed by a caller-supplied command id: a replayed command returns the original result, and a previously-rejected one returns the original rejection, so retry becomes a no-op by construction. The cost is that every command must carry a stable id supplied by its caller, which is an API change reaching every definition and dispatch site; it is worth paying on the write paths that need it rather than blanket.

## Anti-corruption layer for cross-module event consumption

When a module reacts to another module's domain event, that event's schema becomes load-bearing for the reactor. A new field on `OrganizationCreated` is harmless to organization's internal callers; it can break a naive wallet reaction that reads field names off the event directly.

A cross-aggregate reaction is therefore not a use case of its own — it is an **inbound adapter**, structurally identical to an HTTP or CLI endpoint, just on the event-bus transport. It lives at `interface/events/<publisher>.event-adapter.ts`, the only place in a consumer module allowed to import the publisher's barrel. The adapter subscribes to the event, translates it, and **dispatches one of its own module's commands** through the command bus. It is **bus-only**: it touches no repository, no domain ops, no `domain/ports/`. The dispatched command's handler owns the aggregate mutation — the reaction reuses the existing command rather than duplicating its logic in a separate handler. This realizes the Command → Event → Command chain of ADR-0002 and ADR-0006: the reacting module runs its own command.

```
modules/<consumer>/
└── interface/
    └── events/
        └── <publisher>.event-adapter.ts   # subscribes to the event, dispatches a command
```

The command definition _is_ the internal contract; there is no separate trigger type. The adapter translates the foreign event directly into a dispatch:

```ts
export const OrganizationEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const domainEventBus = yield* DomainEventBus;
    const commandBus = yield* CommandBus;
    // `subscribe`, not `subscribeAfterCommit`: a wallet must exist iff its
    // organization does, and this is the consumer that knows that.
    yield* domainEventBus.subscribe(OrganizationCreated, (event) =>
      commandBus
        .execute(CreateWalletCommand, { organizationId: event.organizationId })
        .pipe(Effect.orDie),
    );
  }),
);
```

`subscribe` requires a handler with no requirements and no error channel. Dispatch already satisfies the first: the bus clears the requirement channel, so the handler's services are discharged where the owning module's dispatch surface is composed rather than re-supplied here (ADR-0006) — an adapter that had to hand-provide them was the problem that shaped that decision. The error channel is closed by `orDie` above. The transaction context comes from the ambient publisher fiber. If organization adds a field, only this translation changes.

**Atomicity via nested savepoint.** A reaction that must commit atomically with its publisher — a wallet must exist iff its organization does — uses `subscribe`. Because the adapter then runs in the publisher's fiber, the command it dispatches runs its own `withUnitOfWork` as a **nested savepoint** on the publisher's transaction (see "Nested savepoints"): both commit or both roll back. A reaction that must not be able to undo its trigger uses `subscribeAfterCommit`, and its command runs post-commit in its own transaction — which is how an invitation email is sent, so that a mail-server outage cannot fail the invite and a rolled-back transaction cannot produce a live accept link.

**External IO is a tiered judgment call, not a new stereotype.** If a reaction touches the domain, it dispatches a command (above). A pure side effect that always follows its trigger — a telemetry emit, a notification tied to one command — is colocated in the originating command, not modeled as a reaction. A genuine third-party effect (send an email, ETL to an external system) is performed by a command handler through its client port. `interface/events/` itself stays strictly bus-only.

The pattern is enforced by the `interface-events-isolation` dep-cruiser rule, a positive allowlist that lets an event adapter import only its own module's domain events/ids, its own command definitions, the DDD kernel ports, `platform/ids/`, and — for cross-module events — another module's barrel. This is Vernon's anti-corruption layer at module scope: one adapter per (consumer, publisher) pair.

## Alternatives considered

- **Two buses, the publisher choosing between them.** How this was first built, and reversed. It put the consistency decision on the party that must not know its consumers, so one event could not serve two reactions with different needs; and because both the publisher and every subscriber named a bus, the two had to agree with nothing checking that they did. A subscriber on the wrong bus was a silent no-op.
- **A distinct `IntegrationEvent` type family.** Rejected — a parallel type hierarchy would double the event definitions without buying clarity. Note this leaves the term free for what the literature means by it: a versioned cross-boundary contract, which this package may want later and which is not a delivery mode.
- **Positional dispatch as the post-commit mechanism.** Rejected; see "One bus" above.
- **Pub/sub-backed immediate delivery with forked subscribers.** Rejected — the delivery model precludes the subscriber inheriting `TransactionContext` from the publisher, which is exactly the property `subscribe` needs.
- **Skip the unit-of-work abstraction; open transactions directly in use cases.** Rejected — it forces use cases to depend on the database service, which the unit-test fakes don't provide.
- **Flatten nested runs into the parent transaction.** Rejected — flatten cannot express a recoverable sub-operation, and the database already supports savepoints.
- **Fail-soft immediate subscribers** (a failed `subscribe` handler logs and the publisher commits anyway). Rejected — that is the partial-failure-with-logged-silence behavior that surface exists to prevent. A reaction that _should_ tolerate failure uses `subscribeAfterCommit`.
- **Transactional outbox from day one.** Rejected as premature — the in-memory flush delivers the programming model today; the outbox is the right answer when durability across a commit-then-crash matters, and is cheaper to add once the delivery surfaces are settled.

## Related

- ADR-0003 (events as values) — both buses carry the same value-typed `DomainEvent`.
- ADR-0005 (repository pattern) — the per-call `TransactionContext` check is what makes transaction and savepoint joining automatic for repositories.
- ADR-0009 (testing) — the pass-through unit of work, recording event bus, and the integration tests that exercise the savepoint and post-commit-drain semantics.
