# ADR-0002: Module layout (domain / commands / queries / event-handlers / infrastructure / interface)

- Status: Accepted
- Date: 2026-04-25

## Context and Problem Statement

Each feature module in the codebase needs an internal structure that:

1. Makes the layered-architecture rules expressible to tooling, so that violations fail compilation or CI rather than waiting on code review.
2. Keeps related files close together, so that finding "the thing that does X for the User feature" is mechanical.
3. Is consistent across modules, so that fluency with one module transfers to all of them.

There are two broad styles to choose between. **Vertical slicing** organizes a module by use case, with each slice containing its own controller, service, command, and DTO. **Layered slicing** organizes a module by architectural role, putting all domain code together, all infrastructure code together, and so on.

Vertical slices keep one feature's files together but split closely-related concerns (commands vs. queries vs. domain vs. database) across many siblings. Folder names tend to mix concepts (a `database/` folder is infrastructure; a `dtos/` folder is interface) without saying so.

Layered slicing makes architectural roles explicit in folder names and aligns trivially with dependency-rule enforcement, at the cost of related-use-case files being slightly farther apart.

## Decision

Each feature module lives at `modules/<feature>/` with sibling subfolders, named after the architectural role of the files they contain:

```
modules/<feature>/
  domain/          — pure data, ops, repository ports, errors, events, value objects (aggregate roots are named `*.aggregate.ts` as an explicit DDD signal)
  commands/        — write-side use cases + their bus-registration map
  queries/         — read-side projections (may bypass the domain) + their bus-registration map
  event-handlers/  — write-side reactions to domain events from this or other modules
  infrastructure/  — repository Live + Fake implementations, mappers
  interface/       — one file per HTTP endpoint plus a thin group-registration file (see ADR-0013)
  <feature>-event-span-attributes.ts  — per-event span-attribute extractors aggregated for this module
  <feature>-module.ts                 — the composed Layer for the module
  index.ts                            — barrel: re-exports only what other modules legitimately need
```

Not every module has all six folders — `event-handlers/` and `queries/` are present only when the module needs them.

`commands/`, `queries/`, and `event-handlers/` together correspond to what hexagonal architecture calls the "application layer." There is deliberately no `application/` umbrella over them. The split reflects two real distinctions: write-side vs. read-side (queries can touch `@org/database` and bypass the domain because there is no aggregate to protect when nothing mutates), and use-case-driven vs. event-driven (event handlers run as reactions, not as direct dispatch). Each folder gets its own dependency-cruiser isolation rule (see ADR-0008), so the architectural distinction shows up at the file-system level rather than via convention.

Cross-cutting platform services that don't belong to any feature live in a sibling `platform/` folder: the domain event bus, command/query buses, transaction runner, request context, HTTP middlewares.

### Cross-module access rules

Enforced by static analysis (see ADR-0008):

- Code outside a module imports it only via the module's `index.ts` barrel.
- Modules do not reach into each other's internal folders directly.
- The barrel itself is restricted: it may not re-export anything from `infrastructure/` or `interface/`, so the published cross-module surface is limited to domain types (events, IDs, errors), command/query message types, handler-registration maps and span-attribute aggregators, and the module's `Live` layer.
- Cross-module flow happens via three channels: the published HTTP contract, published domain events, or dispatch through the typed command/query bus (ADR-0006). The bus carries one constraint: a command handler in one module must not dispatch a command in another module — the chain goes through an event (Command → Event → Command). Cross-module _queries_ via the bus are unrestricted; they are reads, with no transactional or coupling consequences.
- Domain events that other modules subscribe to, and command/query schemas that other modules dispatch, are part of the source module's public surface and are re-exported from its `index.ts`.

## Consequences

- Predictable navigation. Every module uses the same folder vocabulary. Finding "the persistence implementation for X" is always `modules/<feature>/infrastructure/`; finding "where the read-side projection for Y lives" is always `modules/<feature>/queries/`.
- Per-use-case slicing (the strength of vertical slicing) is given up. The role-based split aligns with the dependency rules, which is what we're optimizing for.
- A subscriber in another module reaches through the barrel — for example, the wallet module's event handler imports `UserCreated` from `modules/user/index.ts`, not from `modules/user/domain/user-events.ts`. This is intentional: domain events are part of the user module's public contract, the same way the HTTP API is. The same applies to any command or query schema another module is expected to dispatch.
- Adding a new module is mechanical: create the folders the module needs, add a `<feature>-module.ts` Layer, add a barrel-only dependency rule for the new folder.
- If a long-running orchestration appears (saga, process manager) that doesn't fit "single command" or "single event reaction," it gets its own sibling folder and its own isolation rule — the layout is open to that growth without re-introducing an `application/` umbrella.
- Some files have no obvious home: helpers used by multiple use cases within a module, for instance. The default is to colocate them with the use case that owns them, and lift them only when a second use case needs them.

## Alternatives considered

- **Vertical slicing** (folder per use case). Stronger cohesion within a use case; weaker cohesion of the architectural layer as a whole; harder to express dependency rules cleanly. Rejected for this codebase.
- **Three layers (domain / application / infrastructure) without `interface/`.** Folds HTTP bindings into either application or infrastructure. Rejected because the boundary between "use case" and "transport adapter" is the most-changed boundary in practice; giving it its own folder pays off.
- **Single `application/` umbrella over commands, queries, and event-handlers.** The previous shape. Rejected because (a) read-side queries don't share dependency constraints with write-side commands — queries can touch the database directly, commands can't — so an umbrella implies a kinship that doesn't exist, and (b) once queries are carved out, the umbrella contains only commands and event-handlers, which are siblings in every meaningful sense; the umbrella adds nesting without distinguishing them from anything else.
- **Flat module layout with file-name conventions** (e.g. `user.entity.ts`, `user.service.ts`, `user.repository.ts`). Workable for small modules; doesn't scale and conflates layer rules with naming conventions.

## Related

- ADR-0008 (architecture enforcement) makes this layout a runtime check, not just a convention.
- ADR-0005 (repository pattern) details how the port lives in `domain/` and the implementations in `infrastructure/`.
- ADR-0010 (HTTP-only contracts) details what `interface/` actually contains.
