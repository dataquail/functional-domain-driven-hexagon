# ADR-0006: Typed CommandBus / QueryBus via declaration-merged registry

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

CQRS architectures commonly route commands and queries through a bus: handlers register against a tag, and callers invoke `bus.execute(cmd)` rather than calling the handler function directly. The bus serves three purposes:

1. **Decoupling**: callers don't import handler implementations.
2. **Uniform call surface** for any caller that needs to invoke a use case it does not own — transport adapters (HTTP endpoints, CLI commands, message-queue subscribers) and other modules.
3. **A natural seam for cross-cutting behavior**: metrics, audit logs, span naming, and policy checks can be applied in the bus once instead of at every call site.

The traditional cost of a bus is **type erasure**. Most CQRS bus implementations look something like `bus.execute(cmd): Promise<unknown>` — the bus accepts any command, and there is no way at the call site to know what type a command's handler returns or what errors it can fail with. Architectures built on type-erased buses tend to recover the lost types by wrapping handler return values in `Result<T, E>`, which is type information re-encoded into a runtime value to compensate for the bus's erasure.

We want the bus's benefits without paying the type-erasure cost. Effect already provides typed error and dependency channels (`Effect<A, E, R>`); a bus that throws those away is a regression.

## Decision

`CommandBus` and `QueryBus` are Effect services with a single `execute` method whose return type is computed at the call site from the runtime command's `_tag` literal, via a TypeScript declaration-merged registry interface.

### The registry pattern

The platform exports an empty `CommandRegistry` interface. Each command file augments the registry with an entry that maps the command's tag to its command type and its full output Effect type:

```ts
declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    CreateUserCommand: {
      readonly command: CreateUserCommand;
      readonly output: Effect.Effect<
        UserId,
        UserAlreadyExists,
        UserRepository | DomainEventBus | UnitOfWork
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

Each command and query is split into two sibling files (ADR-0024 naming):

- `<verb-noun>.command.ts` (or `.query.ts`) — schema, output type alias, and the `declare module` registry entry. This is the **public contract**. It is re-exported from the module's `index.ts` barrel.
- `<verb-noun>.handler.ts` — the handler function, declared with `Effect.fn("<handlerName>")` (ADR-0012). It imports the command type and output type from its sibling. This file is **internal** to the module; it is imported only by the module's handler map and the use case's tests.

This split exists because the registry entry is what callers need to type-check a `bus.execute(cmd)` call. A consumer in another module — or a transport adapter — should be able to import the command schema and have the registry entry attach itself, without dragging the handler's transitive imports (aggregate ops, value objects, mappers) into the consumer's import graph.

```
modules/<feature>/commands/
  create-user.command.ts   ← schema + registry entry; barrel re-exports this
  create-user.handler.ts   ← handler; imported only by the handler map and tests
```

Queries follow the same pattern under `modules/<feature>/queries/`.

### Who is allowed to dispatch what

- **Transport adapters** (HTTP, CLI, job runners, message subscribers) dispatch any command or query.
- **Cross-module reads.** A module may dispatch another module's `Query` through the bus. Queries have no side effects; reading another module's projection through its published query is the same kind of cross-boundary call as reading its HTTP API, just in-process.
- **Cross-module writes — through events, not the command bus.** A command handler in module A must not dispatch a command belonging to module B via the bus. The sanctioned chain is **Command → Event → Command**: A's command emits a domain event, B subscribes to it, and B's event handler runs B's own command. The bus does not enforce this — it is a strict convention. (The transactional guarantees of the synchronous event bus from ADR-0007 still apply: the Command → Event → Command chain runs in one transaction.)

### Why this works

The mechanism relies on three properties: the `_tag` field of a command instance is a TypeScript string literal (the conditional type can extract it); the `CommandRegistry` is a TypeScript interface that permits cross-module declaration merging; and Effect's `Effect<A, E, R>` carries error and dependency types that survive verbatim through the conditional-type lookup. Together: the bus is an indirection at runtime (a string-keyed dispatch) while remaining fully transparent at compile time.

## Consequences

- Call sites get full type information through the bus. `bus.execute(CreateUserCommand.make({...}))` returns the exact `Effect<A, E, R>` declared in the registry. No casts, no `Result` unwrapping.
- Two-step registration per command: (1) declaration-merge into `CommandRegistry` (in the `.command.ts` file), (2) add an entry to the per-module handler map. This is the boilerplate cost.
- Two files per use case (schema vs. handler) instead of one. Applied uniformly so the convention is mechanical.
- A missing handler or misrouted command is caught by the type checker, not at runtime.
- The bus is a thin lookup. When a uniform behavior is needed across all commands — an audit log entry per dispatched command, or a uniform timing metric — it can be added inside `makeCommandBus` without touching call sites. It already spans every dispatch (ADR-0012).
- The trick is not a widely-known TypeScript pattern. The platform code that implements the bus is small but dense, and worth re-reading before modifying.

## Alternatives considered

- **No bus at all.** HTTP endpoints call use-case functions directly. Rejected because we want the boundary in place if and when non-HTTP transports show up; retrofitting a bus across all call sites is more expensive than tolerating the modest boilerplate today.
- **Runtime registry with reflection** (decorator metadata, `instanceof` matching). Defeats the typed-dispatch goal — there is nowhere in a runtime-discovered handler to attach a per-command return type at the call site.
- **Bus that returns `Promise<unknown>` and relies on `Result<T, E>` for type safety.** Rejected — duplicates Effect's error channel at the value level; forces every consumer to unwrap.
- **Bus generic over the entire registry** (e.g. `CommandBus<Registry>`). The declaration-merged version is simpler at call sites: callers don't thread the registry type parameter.

## Related

- ADR-0004 (errors as `Schema.TaggedErrorClass`) — the `E` channel preserved through the bus.
- ADR-0007 (unit of work) — the `R` channel preserved through the bus is what lets the use case demand `UnitOfWork` and have that requirement visible at the call site.
