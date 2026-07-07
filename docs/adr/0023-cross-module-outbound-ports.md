# ADR-0023: Cross-module outbound calls via consumer-owned ports

- Status: Accepted (folder taxonomy amended by ADR-0025)
- Date: 2026-05-26

> **Amendment (ADR-0025).** The `external/` folder this ADR introduces has since been split by counterpart: cross-context adapters moved to `domain/ports/acl/` + `infrastructure/acl/`, and true third-party adapters to `domain/ports/clients/` + `infrastructure/clients/`. Wherever this document says `external/`, read `acl/` for the cross-bounded-context case it describes (the `foreign-barrel-only-from-outbound-adapter` whitelist now names `infrastructure/acl/`). The consumer-owned-port principle, the load-bearing `domain/`-resident-port guarantee, and the error-translation mechanism below are unchanged.

## Context and Problem Statement

ADR-0006 gives modules a typed command/query bus, and ADR-0007 a synchronous domain-event bus. Together they are the only sanctioned channels for one module to affect another. ADR-0007 also establishes an anti-corruption layer for the _inbound_ direction: when a module consumes another module's domain events, the event schema is translated at a single adapter in `interface/events/` into a consumer-internal trigger, so the publisher's evolving schema never leaks into the consumer's handlers. The `event-handlers-isolation` rule forbids `event-handlers/` from importing other modules' barrels at all; only the inbound adapter may cross the line.

The _outbound_ direction has no equivalent discipline. When a module needs another module to do something — fire a command, answer a query — the current rules let any file in the consuming module import the publisher's barrel directly, construct the message, and dispatch it on the bus. `commands-isolation` and `queries-isolation` both permit `modules/*/index.ts` as an import target.

This is allow-by-default, and it admits two kinds of leakage:

- **Message shape.** A consumer that constructs `GrantRoleCommand.make({ role: "super_admin", actorUserId, userId })` is coupled to that field set. If the publisher restructures the command, every call site changes.
- **Error vocabulary.** Because the bus is typed (ADR-0006), the foreign command's error union rides along with the message type. A consumer that dispatches it inherits the publisher's domain error tags (`CannotPromoteSelf`, `AlreadyHasRole`, …) and ends up catching them — by tag — in its own interface layer. The publisher's domain vocabulary has crossed into the consumer.

The canonical example: the `user` module exposes a `POST /users/:id/super-admin` endpoint because the URL is user-shaped, but the write belongs to the `role` module. Today the endpoint imports `GrantRoleCommand` from `role`'s barrel, dispatches it, and catches `role`'s domain errors directly. The orchestration is correct; the coupling is not contained.

The architectural question is symmetric to the one ADR-0007 already answered for events: where does the boundary-crossing code live, and what stops the publisher's vocabulary from leaking into the consumer?

## Decision

A module that calls another module does so through a **consumer-owned outbound port**. Two collaborating files per (consumer, capability):

- A **port** in `domain/ports/external/<capability>.ts` — a `Context.Tag` whose method signatures and error types are expressed entirely in the consumer's own vocabulary. The port names a capability ("grant super admin to this user"), not a publisher ("the role module").
- An **adapter** in `infrastructure/external/<capability>-live.ts` — the `Live` implementation. This is the _only_ file in the consuming module permitted to import the publisher's barrel, construct the publisher's command/query message, and dispatch it on the `CommandBus`/`QueryBus`. It maps the publisher's results and errors back into the port's own types.

Commands, queries, event-handlers, domain, and interface code all depend on the port. None of them import the publisher's barrel.

This is the outbound mirror of ADR-0007's inbound event ACL. Every module-boundary crossing now passes through exactly one named adapter file, one per direction:

| Direction                                      | Adapter file                                    | May import publisher barrel |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------- |
| Inbound (observe a publisher's events)         | `interface/events/<publisher>-event-adapter.ts` | yes                         |
| Outbound (call a publisher's commands/queries) | `infrastructure/external/<capability>-live.ts`  | yes                         |

`infrastructure/external/` is the correct home because an outbound/driven adapter is infrastructure — it sits beside the repository `Live` implementations, which are themselves outbound adapters. `interface/` in this codebase is the inbound adapter layer (HTTP, inbound events); outbound calls do not belong there.

### Port taxonomy: `domain/ports/{repositories,external}`

Outbound ports are grouped under `domain/ports/`, split by what sits on the other side of the boundary — because that is what determines the anti-corruption obligation:

- `domain/ports/repositories/` — the other side is the module's own datastore. The module owns both sides; no translation is owed.
- `domain/ports/external/` — the other side is another bounded context. The adapter owes error and shape translation.

Both are outbound (driven) ports; the split is _counterpart_, not _direction_. (`outbound/` is rejected as a name precisely because it implies repositories are not outbound, which is false. `services/` is rejected to avoid collision with DDD domain services.)

Placing the external port in `domain/` is not merely tolerated — it is load-bearing. The `domain-isolation` rule (ADR-0008) forbids `domain/` from importing anything foreign: only `effect`, `platform/ids`, and a small set of `platform/ddd` primitives. A port defined there therefore _cannot_ reference the publisher's barrel, command shape, or error types — the rule rejects it. The abstraction is provably consumer-owned, mechanically, with no reviewer judgment required. The foreign vocabulary is confined to the adapter in `infrastructure/external/`, which is unconstrained. The same guarantee would not hold for a port defined next to its adapter.

### Error translation

The port declares its own errors as `Schema.TaggedError` in `domain/` (ADR-0004). The adapter maps the publisher's errors to the port's via `Effect.catchTag`. This is the exact mirror of what an HTTP endpoint already does mapping domain errors to contract errors (ADR-0004) — same mechanism, opposite direction.

Because the bus is typed (ADR-0006), the publisher's full error union is visible at the dispatch site inside the adapter. When the publisher adds a failure mode, it surfaces as a type obligation in the one adapter file rather than as an unmapped foreign tag propagating silently through call sites. Anything the adapter deliberately does not map is converted to a defect, so an unexpected publisher error cannot masquerade as a consumer error.

### Relationship to the platform-level ACL service

A separate, pre-existing pattern routes cross-module data needed by **policies** through a platform-layer service that returns a generalized shape. That pattern is cross-cutting: policies run in middleware, outside any one module, so their ACL lives in `platform/`. The decision here is its module-scope counterpart: a module's _own_ use cases calling another module go through that module's `infrastructure/external/` adapter. The two do not overlap — platform ACL service for policy/authz data; module outbound port for use-case-driven calls — and neither should be rebuilt as the other.

## Enforcement

- A dependency-cruiser rule (`foreign-barrel-only-from-outbound-adapter`) forbids any file under `modules/<m>/` from importing another module's `index.ts`, except `modules/<m>/infrastructure/external/` and `modules/<m>/interface/events/`. It uses the same `$1` backreference technique as the existing barrel rules, so it generalizes to new modules with no config change. Test files are excluded inline. This rule narrows, and does not replace, `module-barrel-only-cross-module` (ADR-0008): the barrel is still the only legal _target_; this rule restricts which consumer folders may aim at a _foreign_ one.
- `commands-isolation` and `queries-isolation` drop `modules/*/index.ts` from their allowlists, since the new rule forbids them from reaching a foreign barrel regardless.
- A test-parity rule requires every `infrastructure/external/*-live.ts` to have a sibling `*-live.integration.test.ts` (or `.test.ts`) and a `*-fake.ts` counterpart, mirroring the live-repository parity rule. The fake lets consumer use-case unit tests run against a focused port double instead of faking the whole typed bus.

## Consequences

- A module's outbound dependencies are auditable in one folder (`infrastructure/external/`). The set of other modules it calls is no longer scattered across commands, queries, and endpoints.
- Publisher message-shape and error-vocabulary changes are absorbed in a single adapter per (consumer, capability) pair, not at every call site.
- Consumer use cases test against a small fake port rather than a typed-bus fake — a meaningful ergonomic gain.
- The cost is real: one port file, one adapter, one fake, and the error-mapping code per capability, where previously a few lines in an endpoint sufficed. The benefit scales with how much foreign vocabulary crossed — a call that leaks only a message shape gains less than one that also leaks several error tags.
- The pattern is established at the first outbound edge rather than retrofitted across many. This is deliberate: the rule supplies a sanctioned alternative (the port) at the moment the first crossing appears, so the convention is cheap to adopt and expensive to skip — the opposite of laying down a prohibition with no path.
- `domain/` gains a `ports/` subtree. Relocating existing repository ports into `domain/ports/repositories/` is permitted but not required by this decision; it is a separate, parity-safe consistency refactor and should not gate adoption of the outbound pattern.

## Alternatives considered

- **Leave outbound calls direct, as today.** Rejected. Allow-by-default is the asymmetry this ADR exists to close: events get an anti-corruption layer, commands and queries do not, for no principled reason once the leakage is named.
- **Forbid foreign barrels from `commands/` and `queries/` without supplying a port.** Rejected. Prohibition without a sanctioned alternative pushes the call somewhere else (the endpoint) rather than containing the coupling. Inverting the dependency behind a port is the containing move.
- **Define the external port next to its adapter in `infrastructure/`.** Rejected. The port would lose the `domain-isolation` guarantee that mechanically keeps it free of foreign types; its purity would again depend on reviewer vigilance.
- **A single flat `domain/ports/` with no sub-split.** Rejected. It conflates "persist my own aggregate" with "call another context" — two outbound dependencies with different anti-corruption obligations — and offers no place that signals which ports owe translation.
- **Name the cross-module folder `services/`.** Rejected — collides with DDD domain services.

## Related

- ADR-0002 (module layout) — the folder this decision extends with `domain/ports/` and `infrastructure/external/`.
- ADR-0004 (errors as `Schema.TaggedError`) — the error-translation mechanism the adapter reuses, mirrored.
- ADR-0006 (typed command/query bus) — the transport the adapter dispatches on, and the source of the exhaustive error union.
- ADR-0007 (synchronous event bus) — the inbound anti-corruption layer this decision mirrors for the outbound direction.
- ADR-0008 (enforcement via dependency-cruiser) — where the new isolation and parity rules live, and the `domain-isolation` rule that makes a `domain/`-resident port provably foreign-free.
