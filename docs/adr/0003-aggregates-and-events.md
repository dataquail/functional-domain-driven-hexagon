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

### State and stereotype naming

Aggregate state is a `Schema.Class`. Identity, timestamps, and invariants live in the schema fields and any `Schema.filter` refinements layered on top. Constructors are obtained via the class's static `make({ ... })`.

Each DDD stereotype in `domain/` is named by an explicit filename suffix and a matching identifier-keyword suffix, so a file's role is legible without opening it:

- **Aggregate root** — `*.root.ts`; the root data type is `XRoot`. For a single-state aggregate that is one `Schema.Class`; for a state machine it is a union `type XRoot = AVariantRoot | BVariantRoot | …` over one class per variant (see "Variant aggregates").
- **Constituent aggregate** — `*.aggregate.ts`: a collection of entities/value objects that is only a _part_ of a root, not itself a consistency-boundary root.
- **Entity** — `*.entity.ts` / `XEntity`.
- **Value object** — `*.value-object.ts` / `XValueObject`: a `Schema.Class` (multi-field) or `Schema.brand`-ed primitive; an attribute-bag with no identity of its own.
- **Branded identifier** — `*-id.ts` / `XId` (e.g. `UserId`). Technically a value object, but kept as its own category: it already carries its keyword and denotes _an entity's identity_ rather than being an attribute-bag, so folding it under `XValueObject` would both mislead and read as `…IdValueObject`.

### Operations

Operations are pure functions taking current state plus inputs (timestamps, ids) and returning either the next state directly or a record discriminated by domain meaning (`{ state, events }`). They are **not** methods or statics on the data class — the aggregate root stays a dumb value. Each root file collects its operations into a single frozen bag exported as `XRootOps`, beside the `XRoot` data type:

```ts
export class UserRoot extends Schema.Class<UserRoot>("UserRoot")({ ... }) {}

export type Result = {
  readonly user: UserRoot;
  readonly events: ReadonlyArray<UserEvent>;
};

const create = (input: CreateInput): Result => { ... };
const markDeleted = (user: UserRoot): Result => ({ user, events: [UserDeleted.make({ ... })] });
const updateAddress = (user: UserRoot, input: UpdateAddressInput): Result => { ... };

export const UserRootOps = { create, markDeleted, updateAddress } as const;
```

Consumers `import { UserRoot, UserRootOps }` and call `UserRootOps.create(...)`. There is deliberately no `import * as User`: every reference is a named import, so an aggregate can't drift to different aliases across files, and the `Root` / `RootOps` split is uniform. Keeping operations as free functions (rather than methods/statics on the data) keeps invariant guards and state transitions expressible as plain, individually-typed functions.

### Lifecycle: guarded total operations (default) vs. variant types

The default — and what every aggregate here does today — is a **single `Schema.Class` whose lifecycle is carried in flag/nullable columns, with total operations that guard their own invariants and return `Either<Result, DomainError>`**. `InvitationRootOps.accept` takes an invitation in _any_ state and returns `InvitationAlreadyAccepted | InvitationRevoked | InvitationExpired` on the left, or the accepted invitation on the right. The invariant checks — and the specific errors they produce — live in the domain, once; every caller (the AcceptInvitation command today, anything else tomorrow) gets identical enforcement for free.

An alternative is to make illegal states unrepresentable: model each state as its own class (a `Schema.TaggedClass` supplies a `_tag` discriminant), union them as the root type, and type each operation to accept only the legal source variant:

```ts
export class AwaitingApprovalWorkOrderRoot extends Schema.TaggedClass<...>()("AwaitingApproval", { ... }) {}
export class ApprovedWorkOrderRoot extends Schema.TaggedClass<...>()("Approved", { ... }) {}
export type WorkOrderRoot = UnsubmittedWorkOrderRoot | AwaitingApprovalWorkOrderRoot | ApprovedWorkOrderRoot;

const approve = (wo: AwaitingApprovalWorkOrderRoot, by: UserId, now: DateTime.Utc): ApprovedWorkOrderRoot => { ... };
export const WorkOrderRootOps = { submit, approve, reject } as const;
```

`approve` won't type-check against an `ApprovedWorkOrderRoot` — the illegal transition is a compile-time error at the call site, and no variant carries a dead `approve` it must refuse at runtime.

**When to reach for variants:** the states carry _different data_ (an `ApprovedWorkOrderRoot` has `approvedBy`/`approvedAt` that `Unsubmitted` doesn't — variants give type-safe field access), or a large operation×state matrix makes compile-time legality worth the structure.

**The cost, and why it is not the default:** statically requiring the right variant moves the "which state is this?" decision _upstream_ of the operation. Something must still narrow an aggregate loaded from the repository (unknown state) into the legal variant — and if that narrowing lives in the caller, every entry point re-implements the invariant→error mapping, defeating the point of a domain that enforces invariants once. If you go variant, centralize the narrowing in a single domain function (`requireAwaitingApproval(wo): Either<AwaitingApprovalWorkOrderRoot, …errors>`) so the guard logic stays in the domain exactly once; the typed `approve` then becomes a pure, can't-fail transition. Prefer guarded total operations when the states share one shape and the same guards recur across operations (as with `InvitationRootOps`'s accept/revoke/reissue, which all re-use the same accepted/revoked/expired checks); the variant split earns its keep only when divergent per-state data or a large transition matrix pays for the extra narrowing step.

When you do use variants, keep the variant classes as top-level named exports (not bagged): their names are already unique, and direct construction (`new ApprovedWorkOrderRoot({ ... })`) reads best. Row→variant reconstitution lives in the mapper, which switches on the persisted discriminant column to build the right variant; the repository `Live` stays dumb (ADR-0005, ADR-0024).

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
const { user, events } = UserRootOps.create({ id, email, address, now });
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
- **Operations as methods or `static` members on the data class** (`class WalletRoot { static credit(...) }`). Rejected — couples behavior to data and breaks down for variant aggregates: an `approve` would have to exist on `ApprovedWorkOrderRoot` too, with nothing to do, and you lose the call-site protection a free function typed to `AwaitingApprovalWorkOrderRoot` gives. It also reads as OO in a functional core.
- **A `namespace XRoot` merged with the class, or `import * as X`.** Rejected — `import * as` lets each consumer pick an arbitrary alias (drift), and a class/namespace merge reintroduces the method-on-data coupling. The `XRoot` type + `XRootOps` value bag give a single named import (`import { XRoot, XRootOps }`) with neither problem, while keeping the ops as plain free functions.

## Related

- ADR-0001 (functional core, imperative shell)
- ADR-0007 (synchronous event dispatch — what the use case does with `events`)
