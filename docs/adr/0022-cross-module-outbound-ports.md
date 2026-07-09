# ADR-0022: Cross-module outbound ports and the clients/acl adapter taxonomy

- Status: Accepted
- Date: 2026-05-26

## Context and Problem Statement

ADR-0006 gives modules a typed command/query bus, and ADR-0007 a synchronous domain-event bus. Together they are the only sanctioned channels for one module to affect another. ADR-0007 also establishes an anti-corruption layer for the _inbound_ direction: when a module consumes another module's domain events, the event schema is translated at a single adapter in `interface/events/` into a consumer-internal trigger, so the publisher's evolving schema never leaks into the consumer's handlers.

The _outbound_ direction needs equivalent discipline. When a module needs another module to do something — fire a command, answer a query — nothing should let any file in the consuming module import the publisher's barrel directly, construct the message, and dispatch it on the bus. That allow-by-default admits two kinds of leakage:

- **Message shape.** A consumer that constructs `GrantRoleCommand.make({ role: "super_admin", actorUserId, userId })` is coupled to that field set. If the publisher restructures the command, every call site changes.
- **Error vocabulary.** Because the bus is typed (ADR-0006), the foreign command's error union rides along with the message type. A consumer that dispatches it inherits the publisher's domain error tags (`CannotPromoteSelf`, `AlreadyHasRole`, …) and catches them — by tag — in its own interface layer. The publisher's domain vocabulary has crossed into the consumer.

The canonical example: the `user` module exposes a `POST /users/:id/super-admin` endpoint because the URL is user-shaped, but the write belongs to the `role` module. The orchestration is correct; the coupling must be contained.

A second pressure: outbound counterparts are not all the same kind. "Something outside my own datastore" quietly holds two profiles with different operational and coupling concerns:

- **A true third-party system** — Stripe, an email provider, the Zitadel OIDC endpoint. Reached over the network; needs secrets, timeouts, retries, signature verification. The anti-corruption obligation is against a vendor's evolving API.
- **Another bounded context inside this monolith** — the `user` module answering a lookup for `organization`. Today an in-process call; tomorrow, if the module is extracted to its own service, a network hop. The anti-corruption obligation is against a sibling team's domain vocabulary.

Co-locating them loses information: a reader can't tell which adapters would become network calls under a service split, nor which legitimately reach into another module's barrel versus which only touch a vendor SDK.

## Decision

### Consumer-owned outbound port

A module that calls another module does so through a **consumer-owned outbound port**. Two collaborating files per (consumer, capability):

- A **port** in `domain/ports/acl/<capability>.acl.ts` — a `Context.Service` whose method signatures and error types are expressed entirely in the consumer's own vocabulary. The port names a capability ("grant super admin to this user"), not a publisher ("the role module").
- An **adapter** in `infrastructure/acl/<capability>.acl-live.ts` — the `Live`. This is the _only_ file in the consuming module permitted to import the publisher's barrel, construct the publisher's command/query message, and dispatch it on the `CommandBus`/`QueryBus`. It maps the publisher's results and errors back into the port's own types.

Commands, queries, event-handlers, domain, and interface code all depend on the port. None of them import the publisher's barrel. This is the outbound mirror of ADR-0007's inbound event ACL — every module-boundary crossing passes through exactly one named adapter file, one per direction (`interface/events/*.event-adapter.ts` inbound, `infrastructure/acl/*.acl-live.ts` outbound), and those two folders are the only places permitted to import a foreign barrel.

### Port and adapter taxonomy: three buckets by counterpart

Both `domain/ports/` and `infrastructure/` are tiered into three sibling folders, matched pairwise — because the counterpart is what determines the anti-corruption obligation and whether the dependency becomes a network call under a service split:

| Counterpart                | Port                         | Adapter                        | May import a foreign module barrel |
| -------------------------- | ---------------------------- | ------------------------------ | ---------------------------------- |
| The module's own datastore | `domain/ports/repositories/` | `infrastructure/repositories/` | no                                 |
| A true third-party system  | `domain/ports/clients/`      | `infrastructure/clients/`      | no                                 |
| Another bounded context    | `domain/ports/acl/`          | `infrastructure/acl/`          | **yes** — the only place           |

`infrastructure/repositories/` holds the `*.repository-live.ts` / `*.repository-fake.ts` / `*.mapper.ts` trio (ADR-0005). `infrastructure/clients/` holds port-backed vendor adapters (`*.client-live.ts` + `*.client-fake.ts`), self-contained service clients that are their own `Effect.Service` with no port (`*.client.ts`), and template components (`*.email.tsx`). `infrastructure/acl/` holds the anti-corruption adapters to sibling modules (`*.acl-live.ts` + `*.acl-fake.ts`).

The name `acl` is chosen over `gateways` deliberately: it names the anti-corruption intent — translate the other context's model into ours — and echoes the inbound-event ACL vocabulary in `interface/events/`. `clients` is the widely understood term for a wrapper over an external SDK or HTTP surface. `services/` is rejected to avoid collision with DDD domain services; a bare `outbound/` is rejected because it implies repositories are not outbound, which is false.

### The bucket is the seam that makes a module relocatable

A port's contract is expressed in the consumer's own vocabulary and says nothing about who fulfills it. That is what makes extracting a module into its own service a _pure adapter swap_: the `acl/` adapter changes from "import barrel, call the sibling's use case" to "make an HTTP request"; the port and every consumer upstream of it are untouched. The split does not create relocation churn — it _localizes_ it. All the dependencies that would become network calls under a service split are pre-grouped in `acl/`; that folder is the module's extraction surface, made visible. Critically, `infrastructure/clients/` is **not** whitelisted to import a foreign module's barrel — a "client" that reaches into a sibling module is a miscategorized ACL and must move to `acl/`.

### The `domain/`-resident port guarantee

Placing the ACL port in `domain/ports/acl/` is not merely tolerated — it is load-bearing. The `domain-isolation` rule (ADR-0008) forbids `domain/` from importing anything foreign: only `effect`, `platform/ids`, and a small set of `platform/ddd` contracts. A port defined there therefore _cannot_ reference the publisher's barrel, command shape, or error types — the rule rejects it. The abstraction is provably consumer-owned, mechanically, with no reviewer judgment required. The foreign vocabulary is confined to the adapter in `infrastructure/acl/`, which is unconstrained.

### Error translation

The port declares its own errors as `Schema.TaggedErrorClass` in `domain/` (ADR-0004). The adapter maps the publisher's errors to the port's via `Effect.catchTag` — the exact mirror of what an HTTP endpoint does mapping domain errors to contract errors, opposite direction. Because the bus is typed (ADR-0006), the publisher's full error union is visible at the dispatch site inside the adapter; when the publisher adds a failure mode it surfaces as a type obligation in the one adapter file. Anything the adapter deliberately does not map is converted to a defect, so an unexpected publisher error cannot masquerade as a consumer error.

### Relationship to the platform-level ACL service

A separate pattern routes cross-module data needed by **policies** through a platform-layer service returning a generalized shape. That pattern is cross-cutting: policies run in middleware, outside any one module, so their ACL lives in `platform/`. The decision here is its module-scope counterpart: a module's _own_ use cases calling another module go through that module's `infrastructure/acl/` adapter. The two do not overlap — platform ACL service for policy/authz data; module ACL port for use-case-driven calls.

## Enforcement

- The dependency-cruiser `foreign-barrel-only-from-outbound-adapter` rule forbids any file under `modules/<m>/` from importing another module's `index.ts`, except `modules/<m>/infrastructure/acl/` and `modules/<m>/interface/events/`. `clients/` is intentionally excluded. It uses the same `$1` backreference technique as the other barrel rules, so it generalizes to new modules. `commands-isolation` and `queries-isolation` do not list `modules/*/index.ts` in their allowlists (ADR-0008).
- The `project-structure/folder-structure` rule (ADR-0008) both admits the closed set of file kinds per tier folder (layout deny-by-default) and requires each port's `-live` / `-fake` / test siblings under the matching `infrastructure/` tier (parity). Anchoring parity on the port means a self-contained client with no port is correctly not required to have a live/fake.
- The `dumb-repository-live-no-app-collaborators` rule (ADR-0005) keys on `infrastructure/repositories/`.

## Consequences

- A module's would-be-network dependencies are auditable in exactly one folder (`acl/`), separate from its vendor integrations (`clients/`) and its own persistence (`repositories/`).
- Publisher message-shape and error-vocabulary changes are absorbed in a single adapter per (consumer, capability) pair, not at every call site.
- Consumer use cases test against a small fake port rather than a typed-bus fake — a meaningful ergonomic gain.
- The cost is real: one port file, one adapter, one fake, and the error-mapping code per capability, where a few lines in an endpoint would otherwise suffice. The benefit scales with how much foreign vocabulary crossed.
- Convention drift is a hard failure, not a review-time catch: the layout allowlist is where a new sanctioned file kind must be declared deliberately, in one place.

## Alternatives considered

- **Leave outbound calls direct.** Rejected — allow-by-default is the asymmetry this ADR closes: events get an anti-corruption layer, commands and queries would not, for no principled reason once the leakage is named.
- **Forbid foreign barrels without supplying a port.** Rejected — prohibition without a sanctioned alternative pushes the call somewhere else (the endpoint). Inverting the dependency behind a port is the containing move.
- **Define the ACL port next to its adapter in `infrastructure/`.** Rejected — the port would lose the `domain-isolation` guarantee that mechanically keeps it free of foreign types.
- **A single `external/` bucket for both third-party and sibling-context.** Rejected — it hides which adapters are network-hop candidates under a service split and which may legitimately import a sibling barrel — the two facts the split exists to surface.
- **Name the cross-context bucket `gateways/`.** Rejected — `gateway` blurs third-party from sibling-context, the very distinction being drawn; `acl` names the anti-corruption intent.
- **Encode the counterpart distinction in the port contract, not just the folder.** Rejected — the port must stay provider-agnostic so relocation is a pure adapter swap; the distinction belongs to the adapter's location.

## Related

- ADR-0002 (module layout) — the folder vocabulary this decision populates.
- ADR-0004 (errors as `Schema.TaggedErrorClass`) — the error-translation mechanism, mirrored.
- ADR-0006 (typed command/query bus) — the transport the adapter dispatches on, and the source of the exhaustive error union.
- ADR-0007 (synchronous event bus) — the inbound anti-corruption layer this decision mirrors for the outbound direction.
- ADR-0008 (enforcement) — the `domain-isolation` rule that makes a `domain/`-resident port provably foreign-free, and the folder-structure rule that enforces the tier layout and parity.
- ADR-0020 (per-module DB schemas) — the "modules are already remote-shaped" posture the `acl/` seam completes.
