# ADR-0003: Aggregates as Schema.Class; pure ops return { state, events }

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

ADR-0001 established that domain logic is pure functions over plain data. This ADR pins down the _shape_ of those data and functions: how an aggregate is represented, how invariants are enforced, and how operations return both the new state and any events the operation produced.

The forces:

- An aggregate must enforce invariants on construction. There should be no way to obtain an aggregate instance that violates its rules.
- Events emitted by domain operations are first-class outputs of those operations, alongside the new state. Their generation should not be a hidden side effect.
- Aggregates need to encode/decode at I/O boundaries (HTTP, persistence) without bespoke serialization code.
- Equality of two aggregate values should be structural, not by reference.

## Decision

### State

Aggregate state is a `Schema.Class`. Identity, timestamps, and invariants live in the schema fields and any `Schema.filter` refinements layered on top. Constructors are obtained via the class's static `make({ ... })`.

Value objects are `Schema.Class` (multi-field) or `Schema.brand`-ed primitives (typed identifiers like `UserId`, opaque tokens, etc.). They participate in the same encode/decode/equality machinery as aggregates.

### Operations

Operations are exported functions co-located with the aggregate they operate on. They take the current state plus inputs (including timestamps and ids) and return a record discriminated by domain meaning:

```ts
export type Result = {
  readonly user: User;
  readonly events: ReadonlyArray<UserEvent>;
};

export const create = (input: CreateInput): Result => { ... };
export const markDeleted = (user: User): Result => ({
  user,
  events: [UserDeleted.make({ ... })],
});
export const updateAddress = (user: User, input: UpdateAddressInput): Result => { ... };
```

### Events

Domain events are tagged structs (`Schema.TaggedStruct`) built via a small platform helper that brands the schema so the event bus can accept the schema directly and infer its payload type at subscribe sites:

```ts
export const UserCreated = DomainEvent("UserCreated", {
  userId: UserId,
  email: Schema.String,
  address: Address,
});
```

### Composition by use cases

Use cases bind these together explicitly:

```ts
const { user, events } = User.create({ id, email, address, now });
yield *
  tx.run(
    Effect.gen(function* () {
      yield* repo.insert(user);
      yield* bus.dispatch(events);
    }),
  );
```

## Consequences

- `Schema.Class` provides encode/decode (used at HTTP and persistence boundaries), structural equality, and `make` factories without any additional code.
- Events are visible at the use-case level. Publication timing is explicit; it cannot be hidden inside an aggregate method or a repository write.
- Pure ops are trivially testable without an Effect runtime. A test calls the op, asserts on the returned `state`, and asserts on the returned `events`.
- Determinism cost: ops accept `now` and `id` as inputs rather than generating them. The use case is the place that calls `DateTime.now` and `crypto.randomUUID`. This is a feature: domain logic stays referentially transparent and trivially testable for "given this input, the same output."
- The discipline forces any side-effecting concern — random ids, current time, persistence, event publication — out of the domain layer and into the use case. The domain code can be read without thinking about runtimes.

## Alternatives considered

- **Aggregate with an internal `_domainEvents` queue.** Rejected — the queue is hidden mutable state that isn't part of the schema, and it couples event publication to repository writes (since the canonical place to drain the queue is on save).
- **Returning a tuple `[User, Events]`** instead of a named record. Rejected — the named record (`{ user, events }`) is clearer at call sites and survives refactors better when a third return value is added.
- **Generating ids/timestamps inside ops.** Rejected. Breaks determinism, forces ops to be `Effect`-typed (which leaks the runtime into the domain), and makes every test that exercises a domain op need a clock.
- **Plain TypeScript classes without Schema.** Rejected — gives up encode/decode at boundaries and structural equality without saving meaningful complexity.

## Related

- ADR-0001 (functional core, imperative shell)
- ADR-0007 (synchronous event dispatch — what the use case does with `events`)
