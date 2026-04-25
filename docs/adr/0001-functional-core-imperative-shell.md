# ADR-0001: Functional core, imperative shell

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

This codebase implements a domain-driven design layered architecture on top of Effect. Effect itself is paradigm-agnostic — domain logic could be expressed as classes whose methods mutate `this` and emit side effects through injected services, or as plain values manipulated by pure functions. The choice shapes everything downstream: how aggregates are constructed, how invariants are enforced, where events come from, how tests are written, and how easily code can be reasoned about in isolation.

We need a single discipline so that a contributor reading any module sees the same shape, and so that the rest of the architectural decisions in this set have a stable foundation to build on.

The forces:

- Domain logic should be testable without a runtime — no DI graph, no time provider, no event bus, no Layer composition required to call a single function.
- Effect Schema integrates naturally with plain data and structurally-typed records. Stateful classes with hidden mutable fields fight that integration.
- Side effects (I/O, time, randomness, event publication) hidden inside aggregate methods make the data flow opaque. The point at which an event becomes "published" matters; making it implicit is a recurring source of bugs around transactional consistency.

## Decision

Domain logic is **pure functions over plain data**. Aggregates and value objects are `Schema.Class` (or `Schema.Struct` / `Schema.TaggedStruct` where appropriate). Aggregate operations are exported standalone functions that take the current state plus inputs and return a record containing the next state and any events the operation produced — they neither mutate nor emit.

```ts
export const create = (input: CreateInput): { user: User; events: ReadonlyArray<UserEvent> } => {
  const user = User.make({ ... });
  return { user, events: [UserCreated.make({ ... })] };
};
```

All effectful concerns — I/O, time, randomness, logging, tracing, event publication — happen in the outer Effect programs (the "shell"), typically use cases in `commands/`, `queries/`, and `event-handlers/`. Domain code uses Effect as a _type_ (e.g. errors are typed via `Schema.TaggedError`) but does not require an Effect runtime to execute its core logic.

## Consequences

- Domain unit tests run with `Effect.runSync` or no runtime at all, over plain data. No fakes for time, no Layer composition.
- Use cases must thread events from domain ops to the bus explicitly. This is the point: publication timing is visible at the use case, not implicit in a repository write or in a method call.
- Some lost ergonomics: `User.create(...).save()` chains aren't possible. Use cases orchestrate explicitly: `const { user, events } = User.create(...); yield* repo.insert(user); yield* bus.dispatch(events)`. The trade is verbosity for legibility.
- Replacing primitives with Value Objects is unaffected — `Schema.Class` works equally well for VOs and aggregates.
- Determinism: ops that need timestamps or ids accept them as inputs (e.g. `User.create({ id, now, ... })`) rather than calling `Date.now()` or `crypto.randomUUID()` themselves. The use case generates them and passes them in. This keeps every domain op a pure function of its inputs.

## Alternatives considered

- **Class with methods that return updated instances** (e.g. `user.delete()` returns a new `User`). Workable, but most behaviors that look like methods on aggregates are better expressed as standalone functions: it removes the pretense that the aggregate is "doing" something on its own behalf, and avoids the temptation to mutate `this`.
- **Aggregate with an internal event queue** (e.g. `aggregate.addEvent(...)` mutating an internal array; repository `save` drains it). Rejected. The event queue is hidden mutable state that isn't part of the schema, and it ties event publication to persistence — making it impossible to publish events without a write, or write without publishing events. Both are real use cases.
- **Domain ops returning `Effect`**. Rejected. Forces every consumer to be inside an Effect runtime to call a domain function, defeats the "no runtime needed for domain tests" property, and adds noise to call sites that are conceptually pure transformations.

## Related

- ADR-0003 details the shape of aggregates, value objects, and event records that follows from this decision.
- ADR-0009 (testing pyramid) leans on this to keep domain unit tests runtime-free.
