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
  domain/          — pure data, ops, ports, errors, events. Stereotypes are dot-delimited suffixes (ADR-0024): aggregate roots `*.root.ts` (`XRoot` data + `XRootOps` free-function bag), constituent aggregates `*.aggregate.ts`, entities `*.entity.ts` (`XEntity`), value objects `*.value-object.ts` (`XValueObject`), branded IDs `*.id.ts` (`XId`), errors `*.errors.ts`, events `*.events.ts`, domain services `*.domain-service.ts` (stateless logic no aggregate owns — ADR-0023). See ADR-0003.
    ports/         — outbound ports, tiered by counterpart (see ADR-0022)
      repositories/ — the module's own datastore (`*.repository.ts`)
      clients/      — true third-party systems (`*.client.ts`)
      acl/          — other bounded contexts (`*.acl.ts`)
  commands/        — `*.command.ts` schema + `*.handler.ts` handler + bus-registration map
  queries/         — `*.query.ts` schema + `*.handler.ts` handler (may bypass the domain) + bus-registration map
  event-handlers/  — write-side use cases (`*.handler.ts`) reacting to internal triggers (event-handlers/triggers/`*.triggers.ts`); same dependency shape as commands
  infrastructure/  — driven adapters, tiered by counterpart to match domain/ports/ (see ADR-0022)
    repositories/  — `*.repository-live.ts` + `*.repository-fake.ts` + `*.mapper.ts`
    clients/       — third-party adapters (*.client-live.ts + *.client-fake.ts, self-contained *.client.ts, *.email.tsx templates)
    acl/           — anti-corruption adapters to other modules (*.acl-live.ts + *.acl-fake.ts); only place that may import a foreign barrel
  interface/       — inbound adapters, one subfolder per protocol
    http/          — one *.endpoint.ts per HTTP endpoint plus an index.ts barrel that registers the endpoint groups (see ADR-0013); may also hold *.util.ts protocol helpers (ADR-0023)
    cli/           — one *.endpoint.ts per CLI endpoint (ADR-0013) plus an index.ts barrel; may hold *.util.ts
    events/        — one *.event-adapter.ts per upstream module whose domain events this module consumes (see ADR-0007)
  policies/        — *.policies.ts registry, *.resource-resolver(s).ts, is-*.policy.ts checks
    public/        — *.service-live.ts: this module's Lives of platform ACL service ports, published to the policy registry
  # module root — a closed set of aggregation/composition files only (ADR-0024); feature code lives in the subfolders above
  <feature>.module.ts                 — the composed Layer for the module
  <feature>.command-handlers.ts / .query-handlers.ts  — bus-registration maps
  <feature>.event-span-attributes.ts  — per-event span-attribute extractors aggregated for this module
  <feature>.shared-deps.ts            — narrow shared-dependency Layer (when a module needs one)
  index.ts                            — barrel: re-exports only what other modules legitimately need
```

Not every module has all six folders — `event-handlers/` and `queries/` are present only when the module needs them. Likewise `interface/http/` is present only for modules that expose HTTP endpoints; `interface/events/` only for modules that subscribe to another module's events.

`commands/`, `queries/`, and `event-handlers/` together correspond to what hexagonal architecture calls the "application layer." There is deliberately no `application/` umbrella over them. The split reflects two real distinctions: write-side vs. read-side (queries can touch `@org/database` and bypass the domain because there is no aggregate to protect when nothing mutates), and use-case-driven vs. event-driven (event handlers run as reactions, not as direct dispatch). Each folder gets its own dependency-cruiser isolation rule (see ADR-0008), so the architectural distinction shows up at the file-system level rather than via convention.

Cross-cutting platform services that don't belong to any feature live in a sibling `platform/` folder: the domain event bus, command/query buses, unit of work, request context, HTTP middlewares.

### Cross-module access rules

Enforced by static analysis (see ADR-0008):

- Code outside a module imports it only via the module's `index.ts` barrel.
- Modules do not reach into each other's internal folders directly.
- The barrel itself is restricted: it may not re-export anything from `infrastructure/` or `interface/`, so the published cross-module surface is limited to domain types (events, IDs, errors), command/query message types, handler-registration maps and span-attribute aggregators, and the module's `Live` layer.
- Cross-module flow happens via three channels: the published HTTP contract, published domain events, or dispatch through the typed command/query bus (ADR-0006). The bus carries one constraint: a command handler in one module must not dispatch a command in another module — the chain goes through an event (Command → Event → Command). Cross-module _queries_ via the bus are unrestricted; they are reads, with no transactional or coupling consequences.
- Domain events that other modules subscribe to, and command/query schemas that other modules dispatch, are part of the source module's public surface and are re-exported from its `index.ts`.

### Typed-ID shared kernel and its governance

`platform/ids/` holds branded entity IDs that more than one module references — `UserId` is the load-bearing example: wallet stores it as `userId` on the `Wallet` aggregate; todos commands carry it through `currentUser.userId`; auth's identity row targets it. Without a shared declaration, each module would redeclare the same `Schema.brand("UserId")` and silently invite drift if one definition ever evolved (e.g. added length or format validation), and TypeScript would treat the two brands as distinct types, forcing coercion at every cross-FK boundary.

The kernel is allowlisted by all four layer-isolation dep-cruiser rules (`domain-isolation`, `commands-isolation`, `event-handlers-isolation`, `queries-isolation`), so any layer can import an ID without weakening the layer's other constraints.

Shared kernels grow into dumping grounds without explicit rules (Newman's "minimal stable shared kernel", Vernon's anti-corruption warning). The governance is therefore narrow and mechanical:

- **Allowed:** branded UUID types whose corresponding aggregate lives in _another_ module, defined as `Schema.UUID.pipe(Schema.brand("<Name>Id"))`. Nothing else. A future ID with a meaningful schema (e.g. a checksum byte) still qualifies — it is still `Schema.X.pipe(Schema.brand(...))`, and the brand is the public surface.
- **Not allowed:** value objects (`Address`, `Money`, `Email` — they carry invariants that belong with their owning aggregate), serialized shapes/DTOs/payloads (those are contracts), validation rules/predicates/parsing helpers, helper functions of any kind, and module-internal IDs.
- **Module-private IDs** (e.g. `WalletId`, `TodoId`) stay in `<module>/domain/`. An ID graduates to `platform/ids/` only when a **second** module needs to reference it; the PR adding the file must name both consumers, and a reviewer rejects the addition if only one can be named.
- **Audit:** a periodic sweep (at least once per major refactor) is mechanical — grep for `platform/ids/<file>` imports, count distinct module roots, and move any ID referenced by exactly one module back to that module's `domain/`.
- **Mechanical enforcement:** a `platform-ids-effect-only` dependency-cruiser rule restricts the folder to effect-only third-party imports, blocking accidental drift toward third-party-coupled shapes (e.g. leaked Drizzle column types). Content discipline (branded IDs only) still rests on the PR review above.

Moving IDs into `@org/contracts` is rejected: contracts are the HTTP wire shape consumed by both server and client, and a server-internal brand is meaningless (or duplicated) there.

## Consequences

- Predictable navigation. Every module uses the same folder vocabulary. Finding "the persistence implementation for X" is always `modules/<feature>/infrastructure/`; finding "where the read-side projection for Y lives" is always `modules/<feature>/queries/`.
- Per-use-case slicing (the strength of vertical slicing) is given up. The role-based split aligns with the dependency rules, which is what we're optimizing for.
- A subscriber in another module reaches through the barrel — for example, the wallet module's event handler imports `UserCreated` from `modules/user/index.ts`, not from an internal file. This is intentional: domain events are part of the user module's public contract, the same way the HTTP API is. The same applies to any command or query schema another module is expected to dispatch.
- Adding a new module is mechanical: create the folders the module needs and add a `<feature>.module.ts` Layer. The barrel-only dependency rules apply automatically to any folder under `src/modules/` (ADR-0008).
- The typed-ID kernel stays a one-line-per-file folder for the foreseeable future, by design. New cross-module IDs are cheap (one file, one PR, reviewer confirms two distinct consumers).
- If a long-running orchestration appears (saga, process manager) that doesn't fit "single command" or "single event reaction," it gets its own sibling folder and its own isolation rule — the layout is open to that growth without re-introducing an `application/` umbrella.

## Alternatives considered

- **Vertical slicing** (folder per use case). Stronger cohesion within a use case; weaker cohesion of the architectural layer as a whole; harder to express dependency rules cleanly. Rejected for this codebase.
- **Three layers (domain / application / infrastructure) without `interface/`.** Folds HTTP bindings into either application or infrastructure. Rejected because the boundary between "use case" and "transport adapter" is the most-changed boundary in practice; giving it its own folder pays off.
- **Single `application/` umbrella over commands, queries, and event-handlers.** Rejected because (a) read-side queries don't share dependency constraints with write-side commands — queries can touch `@org/database`, commands can't — so an umbrella implies a kinship that doesn't exist, and (b) once queries are carved out, the umbrella contains only commands and event-handlers, which are siblings in every meaningful sense.
- **Flat module layout with file-name conventions** (e.g. `user.entity.ts`, `user.service.ts`). Workable for small modules; doesn't scale and conflates layer rules with naming conventions.
- **Eliminate `platform/ids/`; each module redefines its own brand.** Rejected: two `UserId` brands are distinct types to TypeScript, forcing coercion at every cross-FK boundary.

## Related

- ADR-0008 (architecture enforcement) makes this layout a runtime check, not just a convention.
- ADR-0005 (repository pattern) details how the port lives in `domain/ports/repositories/` and the implementations in `infrastructure/repositories/`.
- ADR-0010 (HTTP-only contracts) details what `interface/` actually contains.
- ADR-0024 (dot-delimited filenames) — the stereotype filename convention these folders use.
