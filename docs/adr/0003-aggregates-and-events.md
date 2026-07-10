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

- **Aggregate root** — two files. `*.root.ts` holds the root _data type_ `XRoot`, a dumb `Schema.Class` with no behavior (for a single-state aggregate one class; for a state machine a union `type XRoot = AVariantRoot | BVariantRoot | …` over one class per variant — see "Variant aggregates"). `*.root-ops.ts` holds the _operations_, the `XRootOps` free-function bag. The split into two files is deliberate and explained under "Operations"; the test-parity obligation sits on `*.root-ops.ts`, the dumb `*.root.ts` data carries none.
- **Constituent aggregate** — `*.aggregate.ts`: a collection of entities/value objects that is only a _part_ of a root, not itself a consistency-boundary root. Behavior, when it has any, lives in a sibling `*.aggregate-ops.ts` bag.
- **Entity** — `*.entity.ts` / `XEntity`; behavior in a sibling `*.entity-ops.ts` bag.
- **Value object** — `*.value-object.ts` / `XValueObject`: a `Schema.Class` (multi-field) or `Schema.brand`-ed primitive; an attribute-bag with no identity of its own. Behavior in a sibling `*.value-object-ops.ts` bag.
- **Branded identifier** — `*.id.ts` / `XId` (e.g. `UserId`). Technically a value object, but kept as its own category: it already carries its keyword and denotes _an entity's identity_ rather than being an attribute-bag.
- **Specification** — `*.specification.ts` / `XSpecifications`: a free-function bag of pure predicates and derivations over an aggregate (`isExpired`, `isOpen`, `hasRole`, `statusAt`). It carries no state transition and emits no events (see "Specifications and the operation-stereotype privacy gradient").

### Operations

Operations are pure functions taking current state plus inputs (timestamps, ids) and returning either the next state directly or a record discriminated by domain meaning (`{ state, events }`). They are **not** methods or statics on the data class — the aggregate root stays a dumb value. The operations live in a sibling `*.root-ops.ts` file, collected into a single frozen bag exported as `XRootOps`:

```ts
// user.root.ts — the dumb data type
export class UserRoot extends Schema.Class<UserRoot>("UserRoot")({ ... }) {}

// user.root-ops.ts — the operations
export type Outcome = {
  readonly user: UserRoot;
  readonly events: ReadonlyArray<UserEvent>;
};

const create = (input: CreateInput): Outcome => { ... };
const markDeleted = (user: UserRoot): Outcome => ({ user, events: [UserDeleted.make({ ... })] });
const updateAddress = (user: UserRoot, input: UpdateAddressInput): Outcome => { ... };

export const UserRootOps = { create, markDeleted, updateAddress } as const;
```

Consumers `import { UserRoot } from "./user.root.js"` and `import { UserRootOps } from "./user.root-ops.js"`, then call `UserRootOps.create(...)`. There is deliberately no `import * as User`: every reference is a named import, so an aggregate can't drift to different aliases across files, and the `Root` / `RootOps` split is uniform. Keeping operations as free functions (rather than methods/statics on the data) keeps invariant guards and state transitions expressible as plain, individually-typed functions. The op's success payload — the new state plus emitted events — is named `Outcome` (not `Result`) so it does not shadow the imported `effect/Result` module.

The data and ops are **two files, not one**, because architecture enforcement is by file path, not by imported symbol (ADR-0008). Only command handlers may invoke a mutating op — but read-side code (queries, event adapters, mappers) legitimately imports the `XRoot` data type. Splitting them lets the `root-ops-only-from-command-handlers` rule gate the ops file to the write side while the data file stays freely importable.

### Specifications and the operation-stereotype privacy gradient

A **specification** (`*.specification.ts`) is an `XSpecifications` free-function bag of pure predicates and derivations over an aggregate — `isExpired(token, now)`, `isOpen(workOrder)`, `hasRole(...)`, `statusAt(...)`. It reads state and returns a value; it never transitions state and emits no events. Because reading a predicate mutates nothing, a specification is importable from `domain/`, `commands/`, `queries/`, and the inbound event adapters in `interface/events/` — this is what lets read-side code consult a domain rule without importing the write-gated `*.root-ops.ts`.

Constituent aggregates, entities, and value objects that carry behavior get their own operation bags — `*.aggregate-ops.ts`, `*.entity-ops.ts`, `*.value-object-ops.ts` — each mirroring the `XRootOps` free-function-bag shape.

The operation stereotypes sit on a privacy gradient, enforced by dependency-cruiser (ADR-0008), that realizes the DDD law that an aggregate's internals mutate only through its root:

- `*.root-ops.ts` is the aggregate's single mutation surface and the one operation stereotype that escapes the domain: importable only from its own module's `domain/`, its own `commands/*.handler.ts`, test files, and repository fakes (a test seam).
- `*.entity-ops.ts` / `*.aggregate-ops.ts` / `*.value-object-ops.ts` are **domain-private**: composed hierarchically (root-ops → entity-ops → … → value-object-ops) and importable only within their own module's `domain/`, with `no-circular` backstopping a backwards containment edge. There is no value-object exception — invariant-bearing VO logic (e.g. "a street address may not be blank") stays domain-mediated exactly like entity/root logic; VO immutability buys aliasing safety, not licence to invoke the op from any layer.
- `*.specification.ts` is readable from `domain/`, `commands/`, `queries/`, and `interface/events/`.

Every operation bag and every specification carries a test-parity obligation (its sibling `*.test.ts`); the dumb `*.root.ts` data class does not. Wire-format formatters that are an aggregate's _own_ concern — assembling a credential's `prefix_publicId_secret` wire form, formatting a human-typable user code — stay in that aggregate's `*.root-ops.ts` bag: they are neither predicates (so not specifications) nor cross-aggregate logic (so not domain services, ADR-0023).

### Lifecycle: guarded total operations (default) vs. variant types

The default — and what every aggregate here does — is a **single `Schema.Class` whose lifecycle is carried in flag/nullable columns, with total operations that guard their own invariants and return `Result<Outcome, DomainError>`** (effect v4's `effect/Result`). `InvitationRootOps.accept` takes an invitation in _any_ state and returns `InvitationAlreadyAccepted | InvitationRevoked | InvitationExpired` on failure, or the accepted invitation on success. The invariant checks — and the specific errors they produce — live in the domain, once; every caller (the AcceptInvitation command today, anything else tomorrow) gets identical enforcement for free.

A handler consumes such a `Result` inside its `Effect.gen` by lifting it explicitly with `yield* Effect.fromResult(...)` — v4's `Effect.gen` does not adapt a yielded `Result` (its iterator is distinct from Effect's).

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

**The cost, and why it is not the default:** statically requiring the right variant moves the "which state is this?" decision _upstream_ of the operation. Something must still narrow an aggregate loaded from the repository (unknown state) into the legal variant — and if that narrowing lives in the caller, every entry point re-implements the invariant→error mapping, defeating the point of a domain that enforces invariants once. If you go variant, centralize the narrowing in a single domain function (`requireAwaitingApproval(wo): Result<AwaitingApprovalWorkOrderRoot, …errors>`) so the guard logic stays in the domain exactly once; the typed `approve` then becomes a pure, can't-fail transition. Prefer guarded total operations when the states share one shape and the same guards recur across operations; the variant split earns its keep only when divergent per-state data or a large transition matrix pays for the extra narrowing step.

When you do use variants, keep the variant classes as top-level named exports (not bagged): their names are already unique, and direct construction (`new ApprovedWorkOrderRoot({ ... })`) reads best. Row→variant reconstitution lives in the mapper, which switches on the persisted discriminant column to build the right variant; the repository `Live` stays dumb (ADR-0005).

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

Use cases bind these together explicitly, declaring the transaction once at the boundary (ADR-0007):

```ts
export const createUser = Effect.fn("createUser")(function* (cmd: CreateUserCommand) {
  const repo = yield* UserRepository;
  const bus = yield* DomainEventBus;
  const { user, events } = UserRootOps.create({ id, email, address, now });
  yield* repo.insertOne(user);
  yield* bus.dispatch(events);
  return user.id;
}).pipe(withUnitOfWork);
```

## Consequences

- `Schema.Class` provides encode/decode (used at HTTP and persistence boundaries), structural equality, and `make` factories without any additional code.
- Events are visible at the use-case level. Publication timing is explicit; it cannot be hidden inside an aggregate method or a repository write.
- Pure ops are trivially testable without an Effect runtime. A test calls the op, asserts on the returned `state`, and asserts on the returned `events`.
- Determinism cost: ops accept `now` and `id` as inputs rather than generating them. The use case is the place that calls `DateTime.now` and `crypto.randomUUID`. This keeps domain logic referentially transparent and trivially testable for "given this input, the same output."
- The discipline forces any side-effecting concern — random ids, current time, persistence, event publication — out of the domain layer and into the use case. The domain code can be read without thinking about runtimes.

## Alternatives considered

- **Aggregate with an internal `_domainEvents` queue.** Rejected — the queue is hidden mutable state that isn't part of the schema, and it couples event publication to repository writes (since the canonical place to drain the queue is on save).
- **Returning a tuple `[User, Events]`** instead of a named record. Rejected — the named record (`{ user, events }`) is clearer at call sites and survives refactors better when a third return value is added.
- **Generating ids/timestamps inside ops.** Rejected. Breaks determinism, forces ops to be `Effect`-typed (which leaks the runtime into the domain), and makes every test that exercises a domain op need a clock.
- **Plain TypeScript classes without Schema.** Rejected — gives up encode/decode at boundaries and structural equality without saving meaningful complexity.
- **Operations as methods or `static` members on the data class.** Rejected — couples behavior to data and breaks down for variant aggregates: an `approve` would have to exist on `ApprovedWorkOrderRoot` too, with nothing to do, and you lose the call-site protection a free function typed to `AwaitingApprovalWorkOrderRoot` gives.
- **A `namespace XRoot` merged with the class, or `import * as X`.** Rejected — `import * as` lets each consumer pick an arbitrary alias (drift), and a class/namespace merge reintroduces the method-on-data coupling.

## Related

- ADR-0001 (functional core, imperative shell)
- ADR-0007 (unit of work + event dispatch — what the use case does with `events`)
- ADR-0008 (architecture enforcement — the path rules that gate `*.root-ops.ts` and the constituent op bags)
- ADR-0023 (domain services — the free-function-bag stereotype specifications and ops mirror, and the specification-vs-domain-service boundary)
