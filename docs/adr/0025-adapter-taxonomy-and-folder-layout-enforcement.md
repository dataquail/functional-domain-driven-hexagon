# ADR-0025: Adapter taxonomy (clients vs ACL) and folder-layout enforcement

- Status: Accepted
- Date: 2026-07-02

## Context and Problem Statement

Two loosely related pressures converged.

**First, the outbound-adapter folder was overloaded.** ADR-0023 put every consumer-owned outbound port under `domain/ports/external/` and every driven adapter under `infrastructure/external/`, splitting `domain/ports/` only into `repositories/` (own datastore) and `external/` (everything else). But "everything else" quietly held two different kinds of counterpart with different operational and coupling profiles:

- **A true third-party system** — Stripe, an email provider, the Zitadel OIDC endpoint. Reached over the network; needs secrets, timeouts, retries, signature verification. The anti-corruption obligation is against a vendor's evolving API.
- **Another bounded context inside this monolith** — the `user` module answering a lookup for `organization`. Today an in-process call; tomorrow, if the module is extracted to its own service, a network hop. The anti-corruption obligation is against a sibling team's domain vocabulary (the ACL that ADR-0023 is fundamentally about).

Co-locating them lost information. A reader scanning `infrastructure/external/` could not tell which adapters would become network calls under a service split, nor which ones legitimately reach into another module's barrel versus which only ever touch a vendor SDK.

**Second, folder discipline rested entirely on naming conventions with no allowlist.** Test-parity (ADR-0008 tooling) asks "does this file have its required sibling?" — but nothing asked the inverse: "is this file even allowed to exist in this folder?" An LLM or hurried contributor could add `session-utils.ts` to `domain/` or `todo-helpers.ts` to `commands/` and no gate would object. The failure mode is convention drift: a proliferation of ad-hoc file kinds that should have been methods on an aggregate root or a named stereotype.

## Decision

### 1. Split the outbound adapter into three buckets by counterpart

Both `domain/ports/` and `infrastructure/` are tiered into three sibling folders, matched pairwise:

| Counterpart                | Port                         | Adapter                        | May import a foreign module barrel |
| -------------------------- | ---------------------------- | ------------------------------ | ---------------------------------- |
| The module's own datastore | `domain/ports/repositories/` | `infrastructure/repositories/` | no                                 |
| A true third-party system  | `domain/ports/clients/`      | `infrastructure/clients/`      | no                                 |
| Another bounded context    | `domain/ports/acl/`          | `infrastructure/acl/`          | **yes** — the only place           |

`infrastructure/repositories/` holds the `*-repository-live.ts`, `*-repository-fake.ts`, and `*-mapper.ts` trio. `infrastructure/clients/` holds port-backed vendor adapters (`*-live.ts` + `*-fake.ts`), self-contained service clients that are their own `Effect.Service` with no port (`*-client.ts`), and any template components (`*.tsx`). `infrastructure/acl/` holds the anti-corruption adapters to sibling modules (`*-live.ts` + `*-fake.ts`).

The name `acl` is chosen over `gateways` deliberately: it names the anti-corruption intent — translate the other context's model into ours — and echoes the inbound-event ACL vocabulary already used in `interface/events/`. `clients` is the widely understood term for a wrapper over an external SDK or HTTP surface.

### 2. The port is provider-agnostic; the bucket is the seam that makes a module relocatable

A port's contract is expressed in the consumer's own vocabulary and says nothing about who fulfills it. That is precisely what makes extracting a module into its own service a _pure adapter swap_: the `acl/` adapter's implementation changes from "import barrel, call the sibling's use case" to "make an HTTP request"; the port and every consumer upstream of it are untouched.

The split therefore does not create relocation churn — it _localizes_ it. All the dependencies that would become network calls under a service split are pre-grouped in `acl/`. That folder is the module's extraction surface, made visible. This complements the existing "modules are already remote-shaped" posture: ADR-0021 forbids cross-schema SQL and ADR-0007 routes cross-module reads through the event bus, so a synchronous `acl/` call is the deliberate, and now clearly-labelled, exception rather than an ambient assumption of co-location.

Critically, `infrastructure/clients/` is **not** whitelisted to import a foreign module's barrel. A "client" that reaches into a sibling module is a miscategorized ACL and must move to `acl/`. This is the ADR-0023 `foreign-barrel-only-from-outbound-adapter` rule, retargeted from `external/` to `acl/`.

### 3. A folder-layout allowlist enforces the closed vocabulary

A new check (`pnpm lint:layout`) declares, per stereotype folder, the closed set of file _kinds_ that folder admits, and fails on anything else with a hint pointing at where the logic likely belongs. It is the inverse of test-parity: parity asks whether a required sibling exists; layout asks whether a file is allowed to exist at all.

- Test files are exempt everywhere — they mirror a subject and are already governed by parity and naming rules; the risk being addressed is oddball _source_ files.
- Folders whose primary source file is intentionally free-named (command/query handlers) use a **pairing** rule: a bare `X.ts` is admitted only if its schema sibling (`X-command.ts` / `X-query.ts`) exists — which is exactly what distinguishes a real handler from a smuggled-in utility.
- `domain/ports/` admits no direct files: a port must live in one of the three tier subfolders.

## Enforcement

- `pnpm lint:layout` runs the allowlist and is wired into `check:all` ahead of `lint:tests`.
- The dependency-cruiser `foreign-barrel-only-from-outbound-adapter` rule's whitelist changes from `infrastructure/external/` to `infrastructure/acl/`; `interface/events/` is unchanged. `clients/` is intentionally excluded.
- The `dumb-repository-live-no-app-collaborators` rule and the two test-parity rules that keyed on `infrastructure/*-repository-live.ts` and `infrastructure/external/*-live.ts` are retargeted to `infrastructure/repositories/` and `infrastructure/{clients,acl}/` respectively.
- Moving the Stripe adapter into `infrastructure/clients/` brought it under the outbound-adapter parity rule for the first time (it had previously escaped by sitting in the `infrastructure/` root); its missing unit test — signature verification and webhook-to-domain mapping, both offline — was written as part of this change.

## Consequences

- A module's would-be-network dependencies are auditable in exactly one folder (`acl/`), separate from its vendor integrations (`clients/`) and its own persistence (`repositories/`).
- Convention drift is now a hard failure, not a review-time catch. The allowlist is where a new sanctioned file kind must be declared — deliberately, in one place — rather than accreting silently.
- A small set of pre-existing pure helper files (credential/format generators in `domain/` and `commands/`, OIDC HTTP helpers in `interface/http/`) do not fit any current stereotype. They are held in an explicit, commented `PENDING_DECISION` list in the layout checker — not a general escape hatch — awaiting a follow-up decision on whether to sanction a suffix, fold them onto an aggregate/value object, or relocate them.
- The cost is one more folder level under `infrastructure/` and `domain/ports/`, and the corresponding `**`-recursive globs in the enforcement scripts.

## Alternatives considered

- **Keep a single `external/` bucket.** Rejected. It hides which adapters are network-hop candidates under a service split and which may legitimately import a sibling barrel — the two facts the split exists to surface.
- **Name the cross-context bucket `gateways/`.** Rejected. `gateway` is a catch-all that blurs third-party from sibling-context, the very distinction being drawn; `acl` names the anti-corruption intent.
- **Encode the counterpart distinction in the port contract, not just the folder.** Rejected. The port must stay provider-agnostic so relocation is a pure adapter swap; the distinction belongs to the adapter's location, not the domain's contract.
- **Enforce file kinds with an ESLint plugin (e.g. `eslint-plugin-check-file`).** Rejected. A filesystem-glob script is allowlist-native, catches orphaned files the import graph never sees, emits teaching hints, and matches the existing test-parity tooling — no new dependency, no config surface.
- **Enforce folder membership with dependency-cruiser.** Rejected. It reasons about edges in the import graph, not which files may exist in a folder; an unimported oddball can fall out of the graph entirely.

## Related

- ADR-0002 (module layout) — the folder vocabulary this decision refines.
- ADR-0007 (synchronous event bus) — the inbound-event ACL whose vocabulary `acl/` echoes.
- ADR-0008 (enforcement via dependency-cruiser) — where the retargeted isolation and parity rules live, alongside the new layout check.
- ADR-0021 (per-module DB schemas) — the "modules are already remote-shaped" posture the `acl/` seam completes.
- ADR-0023 (cross-module outbound ports) — amended by this decision: the `external/` folder it introduced is split into `clients/` and `acl/`, and its port sub-split gains a third tier. The consumer-owned-port principle, the `domain/`-resident-port guarantee, and the error-translation mechanism are unchanged.
