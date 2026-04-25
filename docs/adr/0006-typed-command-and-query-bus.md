# ADR-0006: Typed CommandBus / QueryBus via declaration-merged registry

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

CQRS architectures commonly route commands and queries through a bus: handlers register against a tag, and callers invoke `bus.execute(cmd)` rather than calling the handler function directly. The bus serves three purposes:

1. **Decoupling**: callers don't import handler implementations.
2. **Uniform call surface** for any caller that needs to invoke a use case it does not own — transport adapters (HTTP handlers, CLI commands, message-queue subscribers) and other modules. All can dispatch the same command without knowing which use case file it lives in or what dependencies it requires.
3. **A natural seam for cross-cutting behavior**: metrics, audit logs, span naming, and policy checks can be applied in the bus once instead of repeated at every call site.

The traditional cost of a bus is **type erasure**. Most CQRS bus implementations look something like `bus.execute(cmd): Promise<unknown>` — the bus accepts any command, and there is no way at the call site to know what type a particular command's handler returns or what errors it can fail with. Architectures built on type-erased buses tend to recover the lost types by wrapping handler return values in `Result<T, E>`, which is type information re-encoded into a runtime value to compensate for the bus's erasure.

We want the bus's benefits (decoupling, uniform surface, cross-cutting seam) without paying the type-erasure cost. Effect already provides typed error and dependency channels (`Effect<A, E, R>`); a bus that throws those away is a regression.

## Decision

`CommandBus` and `QueryBus` are Effect `Context.Tag`s with a single `execute` method whose return type is computed at the call site from the runtime command's `_tag` literal, via a TypeScript declaration-merged registry interface.

### The registry pattern

The platform exports an empty `CommandRegistry` interface. Each command file augments the registry with an entry that maps the command's tag to its command type and its full output Effect type:

```ts
declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    CreateUserCommand: {
      readonly command: CreateUserCommand;
      readonly output: Effect.Effect<
        UserId,
        UserAlreadyExists | DatabaseError,
        UserRepository | DomainEventBus | TransactionRunner
      >;
    };
  }
}
```

The bus's `execute` is a conditional-typed function that performs a lookup against this registry:

```ts
readonly execute: <C extends RegisteredCommand>(
  cmd: C,
) => C extends { readonly _tag: infer T extends keyof CommandRegistry }
  ? CommandRegistry[T] extends { readonly output: infer O }
    ? O
    : never
  : never;
```

A handler map is built per-module at composition time:

```ts
export const userCommandHandlers = commandHandlers({
  CreateUserCommand: createUser,
  DeleteUserCommand: deleteUser,
  ChangeUserRoleCommand: changeUserRole,
});
```

`commandHandlers` and `makeCommandBus` are typed such that each handler's signature must match the registry entry for its tag. Missing handlers, typo'd tags, and signature mismatches are compile errors.

### File layout: schema and handler are separate files

Each command and query is split into two sibling files:

- `<use-case>-command.ts` (or `-query.ts`) — schema, output type alias, and the `declare module` registry entry. This is the **public contract**. It is re-exported from the module's `index.ts` barrel.
- `<use-case>.ts` — the handler function. It imports the command type and output type from its sibling. This file is **internal** to the module; it is imported only by the module's handler map and the use case's tests.

This split exists because the registry entry is what callers need to type-check a `bus.execute(cmd)` call. A consumer in another module — or a transport adapter — should be able to import the command schema and have the registry entry attach itself, without dragging the handler's transitive imports (`User.create`, value objects, mappers) into the consumer's import graph. The only types the public file references are the module's domain ports and platform tags, which are already part of the public surface anyway.

The convention:

```
modules/<feature>/commands/
  create-user-command.ts   ← schema + registry entry; barrel re-exports this
  create-user.ts           ← handler; imported only by the handler map and tests
```

Queries follow the same pattern under `modules/<feature>/queries/`.

### Who is allowed to dispatch what

The bus is the sanctioned entry point for callers that need to invoke a use case they do not own:

- **Transport adapters** (HTTP, CLI, job runners, message subscribers) dispatch any command or query. This is the primary use today.
- **Cross-module reads.** A module may dispatch another module's `Query` through the bus. Queries have no side effects; reading another module's projection through its published query is the same kind of cross-boundary call as reading its HTTP API, just in-process.
- **Cross-module writes — through events, not the command bus.** A command handler in module A must not dispatch a command belonging to module B via the bus. The sanctioned chain is **Command → Event → Command**: A's command emits a domain event, B subscribes to it, and B's event handler runs B's own command. This keeps write-side modules from forming synchronous dispatch chains that hide their coupling, and it is the rule the reference example follows. The bus does not enforce this — it is a convention, but a strict one. (The transactional guarantees of the synchronous event bus from ADR-0007 still apply: the Command → Event → Command chain runs in one transaction.)

In short: the bus is open to every caller for queries, and to non-command-handler callers for commands. Command handlers reach across module boundaries via events.

### Why this works

The mechanism relies on three properties:

1. The `_tag` field of a command instance is a TypeScript string literal, not a generic `string`. The conditional type can extract it.
2. The `CommandRegistry` is a TypeScript interface, and TypeScript permits cross-module declaration merging on interfaces. Each command file contributes its own entry; the merged interface is global to the module that declares it.
3. Effect's `Effect<A, E, R>` carries error and dependency types in its parameters; those survive verbatim through the conditional-type lookup.

Together: the bus is an indirection at runtime (a string-keyed dispatch) while remaining fully transparent at compile time.

## Consequences

- Call sites get full type information through the bus. `bus.execute(CreateUserCommand.make({...}))` returns the exact `Effect<A, E, R>` declared in the registry. No casts, no `Result` unwrapping.
- Two-step registration per command: (1) declaration-merge into `CommandRegistry` (in the `*-command.ts` file), (2) add an entry to the per-module handler map. This is the boilerplate cost of the abstraction.
- Two files per use case (schema vs. handler) instead of one. The split pays for itself once a command is dispatched across a module boundary; for a command only ever called by HTTP, the second file is mild overhead. Applied uniformly so the convention is mechanical.
- A missing handler or misrouted command is caught by the type checker, not at runtime.
- The bus keeps use cases decoupled from their callers. Today only HTTP handlers call it; future transport adapters (CLI, message-queue subscribers) and other modules' read-side code dispatch through the same surface without importing the handler directly.
- The bus is currently a thin lookup. Cross-cutting concerns (tracing, audit) are still applied at the use-case level via `Effect.withSpan`. When a uniform behavior is needed across all commands — for example, an audit log entry per dispatched command, or a uniform timing metric — it can be added inside `makeCommandBus` without touching call sites.
- The trick is not a widely-known TypeScript pattern. The platform code that implements the bus is small but dense, and worth re-reading before modifying.

## Alternatives considered

- **No bus at all.** HTTP handlers call use-case functions directly. Cheaper. Rejected because we want the boundary in place if and when non-HTTP transports show up; retrofitting a bus across all call sites is more expensive than tolerating the bus's modest boilerplate today.
- **Runtime registry with reflection** (decorator metadata, `instanceof` matching). Defeats the typed-dispatch goal — there is nowhere in a runtime-discovered handler to attach a per-command return type at the call site.
- **Bus that returns `Promise<unknown>` and relies on `Result<T, E>` for type safety.** Rejected — duplicates Effect's error channel at the value level; forces every consumer to unwrap before continuing; gives up the static guarantee that all error variants are handled.
- **Bus generic over the entire registry** (e.g. `CommandBus<Registry>`). Considered. The declaration-merged version is simpler at call sites: callers don't have to thread the registry type parameter, and the registry is implicitly global within the module.

## Related

- ADR-0004 (errors as `Schema.TaggedError`) — the `E` channel preserved through the bus is the same one those errors live in.
- ADR-0007 (transaction runner) — the `R` channel preserved through the bus is what lets the use case demand `TransactionRunner` and have that requirement visible at the call site.
