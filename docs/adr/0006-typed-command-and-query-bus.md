# ADR-0006: Typed CommandBus / QueryBus over per-module dispatch surfaces

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

CQRS architectures commonly route commands and queries through a bus: handlers register against a tag, and callers dispatch a message rather than calling the handler function directly. The bus serves three purposes:

1. **Decoupling**: callers don't import handler implementations.
2. **Uniform call surface** for any caller that needs to invoke a use case it does not own — transport adapters (HTTP endpoints, CLI commands, job runners, message subscribers) and other modules.
3. **A natural seam for cross-cutting behavior**: spans, metrics, and audit logging can be applied once in the bus instead of at every call site.

The traditional cost of a bus is **type erasure**. Most CQRS bus implementations amount to `execute(msg): Promise<unknown>` — the bus accepts anything, and the call site cannot know what a handler returns or how it can fail. Architectures built on type-erased buses tend to recover the lost types by wrapping handler results in `Result<T, E>`, which is type information re-encoded as a runtime value to compensate for the bus's own erasure.

We want the bus's benefits without paying that cost. Effect already carries success, error, and dependency types in `Effect<A, E, R>`; a bus that throws them away is a regression.

## Decision

### A message definition is the whole contract

Each command and query is declared once, as a definition carrying its payload, success, and failure **schemas** plus its side (command or query):

```ts
export const CreateUserCommand = Command.make("CreateUserCommand", {
  payload: { email: Schema.String },
  success: UserId,
  failure: Schema.Union([UserAlreadyExists, PersistenceUnavailable]),
});
export type CreateUserPayload = Command.Payload<typeof CreateUserCommand>;
```

The definition's identifier **is** its tag: a definition declared `"CreateUserCommand"` is exported under that name, and a handler is named for the definition it implements plus a `Handler` suffix (`createUserHandler`). Nothing forces the identifier and the tag to agree — the tag is a string — so the convention is what keeps a reader from having to open a file to learn whether a symbol is a command, a query, or the function that answers one. The payload type keeps the shorter `CreateUserPayload`, since `Payload` already marks it as belonging to a message.

`success` defaults to void and `failure` to the empty union, so a fire-and-forget command declares only a payload. The definition is the single source of truth: it types the dispatch site, it types the handler, and it publishes the payload type the handler names. Declaring the channels as schemas rather than bare types is what lets a message travel over a wire if a module is ever extracted; in-process nothing is ever encoded. Because nothing is encoded, that portability would otherwise be an untested claim, so the package ships a checker (`Command.checkSerializable` and its query and event counterparts) that generates values from each declared channel and round-trips them through JSON. A module asserts it in a test. In practice the check is quiet for ordinary contracts — branded ids, nullables, arrays, dates and tagged errors all have JSON forms — and fires on the escape hatches that make a payload unportable: a channel declared `Unknown`, or a class named through `instanceOf`.

Because the definition carries its side, a query cannot be dispatched on the command bus and a command's handlers cannot be registered against a query group. That is the CQRS distinction the two buses exist to express, and it rests on the message itself rather than on two parallel bookkeeping structures.

### Dispatch is typed by the definition, not by a registry

`execute` takes the definition plus that message's payload:

```ts
bus.execute(CreateUserCommand, { email }); // Effect<UserId, UserAlreadyExists | PersistenceUnavailable, never>
```

The signature is read off the thing being dispatched. Nothing else needs to know it, so there is no side table keyed by tag that a message's own declaration could drift from, no `declare module` block per message, and no conditional-type lookup standing between a call site and its inferred type.

### The requirement channel stops at the bus

`execute` hands back `A` and `E` with `R` cleared. A caller dispatches a message without providing anything, from anywhere.

Handler requirements are the bus's business, not a caller's. A caller seeing a payment gateway or the database service in its inferred type is reading a leaked implementation detail, and it cannot act on that information usefully: only the HTTP layer has a Layer to lift such services into, so every other caller ends up re-supplying captured singletons by hand. Preserving `R` through the bus cost roughly two dozen `provideService` calls across event adapters, cross-module adapters, policy contributions, resource resolvers, and the auth middleware — plus two unchecked casts in event adapters, where the residual requirement could not be satisfied at all because the service was not in scope when the Layer was built.

Clearing `R` does not mean trusting the composition root. Handler requirements ride on the owning module's dispatch surface Layer, so the compiler still checks them — they are simply discharged where the module is composed rather than where a message is dispatched. Handlers run in the **dispatching fiber**, which is what lets a dispatched command join its caller's transaction (ADR-0007).

### Per-module dispatch surfaces

Each module publishes **its own slice** of the dispatch surface — one method per tag it owns — as a Tag exported from its barrel, built from that module's message group:

```ts
const walletCommandGroup = Command.group(CreateWalletCommand);

const WalletCommandHandlersLive = Command.handlersOf(walletCommandGroup, {
  CreateWalletCommand: (payload) =>
    createWalletHandler(payload).pipe(Effect.provide(WalletRepositoryLive)),
});

export class WalletCommands extends Context.Service<
  WalletCommands,
  Command.Dispatcher<typeof walletCommandGroup>
>()("…/WalletCommands") {}

export const WalletCommandsLive = Layer.effect(
  WalletCommands,
  Command.dispatcher(walletCommandGroup, { spanAttributes: walletCommandSpanAttributes }),
).pipe(Layer.provide(WalletCommandHandlersLive));
```

Registering a group's handlers produces a Layer that **carries the handlers' requirements on its own requirement channel**. That single property is what the rest of this decision turns on.

It is why a module can absorb its own outbound adapter. The requirement that adapter carries — the foreign module's surface — is **inferred** onto the registration Layer rather than written down, so the consuming module provides its own adapter without ever naming a foreign type. That distinction is load-bearing, not cosmetic: a registration whose output type had to be written by hand would force the module to name that requirement, reintroducing exactly the cross-module type dependency the outbound port exists to remove and tripping the barrel-import rule (ADR-0008). Inference leaves the foreign surface visible only as a requirement satisfied at the composition root, where knowing both modules is legitimate.

An outbound cross-module adapter resolves the surface of the module it actually talks to, never the app-wide bus. This is the load-bearing reason the surfaces are per-module. A single bus Layer whose requirements were computed from every module's handlers at once does not compose: several outbound adapters dispatch through a bus and are themselves required by handlers, so the one bus Layer would depend on an adapter whose Layer depends on that same bus. The cycle cannot be dissolved by naming the bus in the port's requirement channel either: an outbound port lives in `domain/`, and the domain-isolation rule does not admit the bus there. That exclusion is deliberate and load-bearing rather than incidental — it is why the allowlist stays silent about the package the buses live in (ADR-0008).

That cycle is an artifact of **aggregation, not a real dependency**. The bus aggregates every module, so requiring it inside a handler's dependency graph manufactures an edge between modules that never reference each other. Naming one module leaves the real cross-module graph, which is acyclic: the modules whose handlers reach outward sit above the modules they reach, and the composition root states that order once. A genuine cycle between two modules would surface there as an unresolvable Layer — the desired outcome, not a problem to work around.

### Cross-cutting behavior is middleware, not bus internals

The seam the bus exists to provide is explicit: a dispatcher takes middleware, each wrapping one tag's dispatch function, applied outermost-first.

A middleware may not change the success or error channels. That constraint is what lets the seam exist without weakening the property the whole design rests on: a caller's type is read off the message definition, so anything able to widen the error channel here would silently invalidate every `catchTag` written against it. Retry, timeout with a fallback, logging, metrics and tracing all fit inside it; validation does not, which is the reason schema conformance is asserted in tests rather than enforced at dispatch.

Tracing is itself the first middleware rather than something the bus does — the dispatcher installs it, the transport adds none. Metrics and deadlines ship alongside it, so the seam has real users from the start rather than being a hook for nobody. A deadline raises expiry as a _defect_: a limit is a property of how the host dispatches, not of the message, so no definition declares it and no call site could be expected to handle it — which is also what keeps it inside the no-widening rule. The cost is real and small: a dispatch traced through middleware measured about 1.5µs slower than when the transport opened the span itself.

### The app-wide buses are tag routers

`CommandBus` and `QueryBus` remain single Tags. Each folds the composed module surfaces into one table and routes by tag, so the uniform call surface and the cross-cutting seam are unchanged and no dispatch site knows which module answers.

The table is **erased** — tag to dispatch function, no signature. It does not need one: what checks a module's handlers is that module's own registration against the same definitions the caller dispatches. A tag claimed by two modules is a wiring bug that would let the wrong module answer a message; the merge rejects it at composition time.

Erasure leaves one gap the type checker cannot close: a module whose dispatch surface was never merged. Every call site still compiles, and the first dispatch of one of its tags dies — possibly in production, on a rarely-exercised path. Two checks close it from opposite sides.

At boot, the composition root tells the bus which groups it means to route, and the bus refuses to build if the table does not cover them, naming the tags. `declaredIn` means the groups this bus is meant to route, not every group the application declares: a module may legitimately own a group its own dispatch surface is the only server of — a policy-query published for other modules' authorization checks is exactly that, reached through the consumer's own outbound adapter and never routed by tag.

In CI, a test reflects over every module's published surface and asserts that each message it exports belongs to some group. That is the half no bus can check: a definition nobody put in a group is absent from every table, so there is nothing for the bus to compare against. Reflection rather than a list, so a message added to a module is covered without anyone remembering.

Registration itself checks both channels precisely. A handler that fails with an error outside its tag's declared union does not compile — whether that error is the only one it can raise or sits alongside a declared one — and neither does a handler whose success value is the wrong type, including for a tag whose declared success is `void`. The check is one-directional, as assignability should be: a handler failing with _fewer_ errors than its tag declares is accepted. A declared union can therefore over-promise, leaving dispatch sites handling errors that cannot occur, and nothing flags it — the compiler cannot distinguish an inaccuracy from a deliberate reserve.

One residual looseness affects dispatcher-shaped _values_ rather than handlers: an object assigned to a `Dispatcher` type whose declared success is bare `void` may return a value. Effect's covariance witness is itself a function returning `A`, so TypeScript's void-return rule reaches inside `Effect<void>`. It does not reach handler registration, where the expected success type is a union rather than bare `void`. The practical exposure is a hand-written test stub returning something its caller discards.

Neither bus opens a span, because each module's dispatcher opens its own (ADR-0012).

### Implemented on RPC, in a standalone package

The buses are not bespoke platform code. They are built on Effect's RPC module — a request/response protocol with typed schemas per method, which is the same shape a typed message bus needs — driven in its no-serialization mode, so values pass by reference and are never encoded. Group registration is RPC handler registration, which is where the requirement-hoisting property above comes from rather than being something we implemented.

This lives in a standalone `@org/cqrs` workspace package that the server imports, for two reasons. It keeps the abstraction honest: the package exposes command/query vocabulary only and leaks no RPC types, which is asserted by tests and by architecture rules rather than left to discipline. And the Effect ecosystem has no full CQRS library, so this is staged for eventual extraction and publication.

The package owns the whole pattern, not half of it: declaring and handling messages, a module's own dispatch surface, the application-wide bus with its routing table, and — because a CQRS library that stops at the two request/response buses leaves consumers to reinvent the fan-out half — the domain-event bus, the unit-of-work port it hangs off, process managers, and the middleware seam. Keeping any of it out would leave every consumer to rebuild it, which is the difference between a CQRS library and an RPC wrapper (ADR-0007 covers the event and unit-of-work half).

The rpc dependency is confined to a single file. Everything else in the package works against carrier type aliases that file exports, so replacing the transport is a rewrite of one file rather than a hunt through the package, and a dependency rule keeps it that way. That containment is worth something concrete rather than hypothetical: the rpc module is explicitly unstable and pinned to an exact beta, and the package is meant to be published — the day a bump breaks something, the blast radius is one file.

Deliberately _not_ an abstract transport interface. Describing a transport in the abstract before a second one exists would mean erasing the carrier types at the boundary, paying in casts and readability for a generality nobody is using.

What the transport gives us is pinned by tests, because none of it is behavior this package implements and all of it is behavior a consumer depends on: a handler observing the dispatching fiber's context, a declared failure arriving unwrapped, a defect staying a defect, and concurrent dispatches not serialising. Those tests exist so an rpc bump fails here rather than in someone's production.

One limitation is pinned the same way, as the behavior it is rather than the behavior one would want, and it is narrower than it first appears. Interruption that **originates in the dispatching fiber** — a `timeout`, losing a `race` — does reach the handler and abort it. Interruption applied from **outside** that fiber does not: the caller unblocks promptly, but the handler runs to completion on the transport's own fiber.

The cause is not configurable. Neither transport end exposes an interruption option; the transport is _supposed_ to handle this and has the machinery on both sides, but under external interruption the client's interrupt notification never crosses the bridge — it is emitted by a finalizer on the fiber being torn down, and work started during that teardown does not complete. The obvious workaround, having the dispatcher convert external interruption into a race the handler loses, fails for the same reason: the conversion also has to run during teardown.

The practical exposure is therefore a client that hangs up mid-request. Because a command handler declares its transaction at its own boundary, that request still commits — all of it or none of it, never halfway. We accept it: completing an operation the user did ask for is a defensible outcome (and a common one in production systems), the alternative would be a behavior change rather than a bug fix, and no dispatcher-side fix is available. Where a deadline is genuinely wanted there is a middleware for it (`Middleware.deadline`), and it does abort the handler — a timeout is interruption from the inside. It is not installed by default: what a sensible limit is, and whether abandoning work partway beats finishing it, are decisions only the host can make.

Two consequences of publishing the bus rather than keeping it in the application. The Tag's identifier is namespaced (`@org/cqrs/CommandBus`), because a bare identifier in a published package invites collision. And the bus factories can no longer be fenced off by a filename convention: they are re-exported from the package barrel, so every importer resolves to the same module and a path-based rule cannot tell them from the Tags that ordinary code legitimately imports. Restricting the _named_ import is what keeps bus construction at a composition root — a lint rule on names, not on paths (ADR-0008).

### File layout: definition and handler are separate files

Each message is split into two sibling files (ADR-0024 naming):

- `<verb-noun>.command.ts` (or `.query.ts`) — the definition, its result view schemas, and the exported payload type. This is the **public contract**, re-exported from the module's barrel.
- `<verb-noun>.handler.ts` — the handler, declared with `Effect.fn("<handlerName>")` (ADR-0012), taking the payload type from its sibling. **Internal** to the module: imported only by the module's registration file and the handler's own tests.

The split keeps a consumer's import graph clean. Importing a message contract must not drag the handler's transitive imports — aggregate ops, value objects, mappers — along with it.

### Who is allowed to dispatch what

- **Transport adapters** dispatch any of their own module's commands and queries.
- **Cross-module reads** go through the consumer's own outbound port, whose adapter is the one place permitted to dispatch the foreign query (ADR-0022). A module does not reach for another module's query directly.
- **Cross-module writes default to Command → Event → Command**: A's command emits a domain event, B translates it at an inbound adapter, and B dispatches its own command (ADR-0007). The bus does not enforce this; it is convention.
- **The exception is a write whose result the caller needs synchronously, inside its own unit of work.** Just-in-time user provisioning on first sign-in is the case: sign-in cannot proceed without the new user's id, so an event reaction is the wrong shape. It goes through an outbound port exactly like a cross-module read, and because the adapter composes a command rather than opening its own unit of work, the write joins the caller's transaction.

## Consequences

- Call sites get full success and error type information through the bus, with nothing to provide. Dispatching reads the same everywhere — HTTP endpoint, CLI endpoint, event adapter, or another module's outbound adapter.
- Each message is declared once. Adding one is a definition plus an entry in its module's registration map; there is no second structure to keep in sync.
- A module absorbing its own adapters removes them from the composition root. Cross-module adapters went first, and the same argument then applied to two module-owned services that had been hoisted only because a handler's requirement used to reach the endpoints through the bus (an outbound mailer) and because an adapter needed swapping per environment (a payment gateway — which becomes two named module Lives rather than a port Tag at the root, so the swap stays inside the module).
- Cross-module dependency order becomes explicit at the composition root instead of implicit in one aggregate bus. That is more wiring to read, and it is the point: the order is the module graph, and the compiler rejects an order that contradicts it.
- A dispatch surface is a plain object of typed methods, so a test standing in for another module's write side writes an ordinary typed stub with no cast. That has already caught real fabrications: stubs that had been faking an error tag and an absent timestamp behind a cast stopped compiling.
- Two files per use case (definition, handler), applied uniformly so the convention is mechanical.
- A duplicate tag is caught when the table is merged, and a module missing from it when the bus is built — both at boot. A message that reached no group at all is caught in CI. The type checker still checks none of it; that is the price of the erased routing table, and the two checks are what make the price affordable.
- Cross-cutting behavior is added once, as middleware, without touching call sites — and cannot change what a call site's types say.
- A message's channels are asserted portable in a test, so "these are schemas, so a module could be extracted" is a claim the build defends rather than an intention.

## Alternatives considered

- **No bus at all.** Endpoints call use-case functions directly. Rejected because the boundary should exist before non-HTTP transports do; retrofitting one across every call site is more expensive than the modest boilerplate now.
- **A declaration-merged registry keyed by tag.** Adopted first, then removed — it restated every message's signature in a second place that could drift, and the conditional-type lookup was dense to read. Do not reintroduce it; the definition already holds those facts.
- **Preserving the requirement channel through the bus.** Adopted first, then removed. It pushed handler wiring onto every non-HTTP caller and forced unchecked casts where the services were not in scope. Handler requirements are the bus's business.
- **One bus as a Layer whose requirements are computed from all modules' handlers.** Rejected — it does not compose, because outbound adapters both dispatch through the bus and are required by handlers. The cycle is aggregation, not a real dependency.
- **A bus returning `Promise<unknown>` with `Result<T, E>` for safety.** Rejected — duplicates Effect's error channel at the value level and forces every consumer to unwrap.
- **Runtime registry with reflection** (decorator metadata, `instanceof` matching). Rejected — there is nowhere in a runtime-discovered handler to attach a per-message return type at the call site.
- **A bus generic over the whole message set** (`CommandBus<Messages>`). Rejected — callers would thread a type parameter to gain nothing the definition does not already give them.
- **Writing the bus by hand on `Deferred` and a `Map` instead of on RPC.** Rejected — the requirement-hoisting behavior that the per-module surfaces depend on would then be ours to implement and maintain.

## Related

- ADR-0004 (errors as `Schema.TaggedErrorClass`) — the `E` channel preserved through the bus.
- ADR-0007 (unit of work and event buses) — handlers run in the dispatching fiber, so a command dispatched inside a publisher's transaction lands in a nested savepoint; also the Command → Event → Command chain that cross-module writes default to.
- ADR-0008 (architecture enforcement) — the domain-isolation rule that rules out naming a bus in an outbound port's requirement channel, and the barrel-import rule that makes a module infer rather than name a foreign requirement.
- ADR-0012 (observability) — the per-dispatch span and the per-module span-attribute map the bus constructor takes.
- ADR-0022 (cross-module outbound ports) — the ports that dispatch foreign messages, and the source of the exhaustive error union they translate.
- ADR-0024 (dot-delimited stereotype filenames) — the `.command` / `.query` / `.handler` naming this layout uses.
