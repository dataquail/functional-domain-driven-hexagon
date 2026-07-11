# Plan: Domain operation stereotypes + event reactions as interface adapters

Status: Draft for review
Author: (pairing with Claude)
Related ADRs: 0002 (module layout), 0003 (aggregates & ops), 0006 (command/query bus), 0007 (unit of work & event buses), 0008 (enforcement), 0022 (adapter taxonomy), 0023 (domain services & interface utils), 0024 (dot-delimited filenames)

## Why

Two gaps let mutation logic escape the aggregate boundary the architecture claims to protect:

1. **The `Ops` bag lives inside `*.root.ts`, so it cannot be gated.** dependency-cruiser matches file paths, not imported symbols. Because `WalletRoot` (data) and `WalletRootOps` (behavior) share one file, no rule can say "a query handler may read the type but not invoke a mutation." Today query handlers, event handlers, and repository fakes all reach into `*RootOps` freely.
2. **Event reactions mutate aggregates directly**, contradicting the ADR-sanctioned `Command → Event → Command` chain ([ADR-0002:65](adr/0002-module-layout.md), [ADR-0006:86](adr/0006-typed-command-and-query-bus.md)). The `event-handlers/` folder acts as a second write-side use-case layer, and the `event-handlers-isolation` rule _forbids_ the very command dispatch the ADRs describe. The billing handler documents the deviation in a comment.

This plan closes both, plus completes the tactical-DDD primitive set with a `.specification` stereotype.

The end state:

- **`*.root-ops.ts`** (the mutation surface) is importable from **`commands/*.handler.ts` only** — the tightest possible mutation boundary.
- **Aggregate internals mutate only through the root** — `*.entity-ops.ts` / `*.aggregate-ops.ts` / `*.value-object-ops.ts` are domain-private (composed hierarchically within `domain/`, unreachable from outside it).
- **Event reactions are inbound adapters** in `interface/events/`, structurally identical to HTTP/CLI endpoints: they translate an inbound event into a command and dispatch it through the bus, touching no aggregate or repository directly.

## Scope of the change (empirical)

| Item                                                    | Count / location                                                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.root.ts` files to split into data + ops              | 12 (all modules)                                                                                                                                     |
| Read-predicates to drain into `*.specification.ts`      | 3 aggregates: `invitation` (`isOpen`/`isAccepted`/`isRevoked`/`isExpiredAt`/`statusAt`), `api-token` (`isExpired`), `organization-roles` (`hasRole`) |
| Event reactions to refactor into dispatch-only adapters | 2 (`wallet/create-wallet-when-organization-is-created`, `billing/sync-subscription-from-stripe-webhook`)                                             |
| Trigger files eliminated                                | 1 (`wallet/event-handlers/triggers/organization.triggers.ts`)                                                                                        |
| New command+handler pairs created                       | 2 (`wallet: CreateWallet`, `billing: SyncSubscription`)                                                                                              |
| Entities / constituent aggregates today                 | 0 (`*.entity-ops` / `*.aggregate-ops` are provisioned, not yet used)                                                                                 |
| Value objects with ops today                            | 0 (`*.value-object-ops` provisioned, not yet used)                                                                                                   |

## Part A — Domain operation stereotypes

### A1. Split `*.root.ts` → data + ops

`*.root.ts` keeps **only** the `Schema.Class` data type (and its input/`Outcome` types if colocated reads better). All operations move to a sibling `*.root-ops.ts` exporting `XRootOps`.

```
domain/wallet.root.ts        // export class WalletRoot extends Schema.Class ... {}
domain/wallet.root-ops.ts    // export const WalletRootOps = { create, credit, debit } as const
domain/wallet.root-ops.test.ts
```

`*.root.ts` becomes a dumb value with **no test-parity obligation** (there is nothing to test on a schema). The obligation moves to `*.root-ops.test.ts`. Consumers `import { WalletRoot }` and `import { WalletRootOps }` separately — both still named imports, no `import * as`.

### A2. New `*.specification.ts` — read-predicates

Pure predicates over an aggregate move out of the ops bag into `*.specification.ts` (DDD Specification: a composable predicate encapsulating a business rule). This is **load-bearing for the whole plan**: it is what lets query handlers keep reading domain predicates after `*.root-ops.ts` becomes write-only.

```
domain/invitation.specification.ts       // export const InvitationSpecifications = { isOpen, isExpired, statusAt, ... }
domain/invitation.specification.test.ts
```

- Query handlers import `InvitationSpecifications.isOpen` instead of `InvitationRootOps.isOpen`.
- Mutation guards inside `*.root-ops.ts` import specifications too (e.g. `accept` checks `isAccepted`) — a domain-internal edge, allowed.
- **Anti-anemia guard** (mirrors ADR-0023): a specification is for a _named, reused, or composed_ business rule — not every one-line derived boolean. Trivial internal predicates may stay private helpers inside `*.root-ops.ts`. Only promote a predicate to a specification when it is read _outside_ the ops file or genuinely composes.

### A3. Provision `*.entity-ops.ts`, `*.aggregate-ops.ts`, `*.value-object-ops.ts`

Declared now (per decision), unused until the first behavioral entity / constituent aggregate / value-object-with-behavior appears. Each carries a `*.<stereotype>.test.ts` parity obligation that only fires when the file exists.

### A4. The privacy gradient (the DDD proxy law)

The rule to gate ops is not "proxy mutations" — it is **keep domain invariant-enforcement inside the domain, mediated by the aggregate root.** A value-object op that encodes a business rule (`Address.updateStreet` enforcing "street not blank") is invariant-bearing domain logic and is gated exactly like an entity or root op. VO immutability buys aliasing safety, not a licence to invoke the rule from any layer.

| Stereotype                                                         | Importable from                                                           | Rationale                                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `*.root-ops.ts`                                                    | own `domain/`, own `commands/*.handler.ts`, tests, `*.repository-fake.ts` | The one op surface that escapes the domain. Only write-side use cases drive it.                                          |
| `*.entity-ops.ts` / `*.aggregate-ops.ts` / `*.value-object-ops.ts` | own `domain/` only, tests                                                 | **Domain-private.** Composed hierarchically (root → entity → sub-entity → VO); nothing outside `domain/` may touch them. |
| `*.specification.ts`                                               | own `domain/`, own `commands/`, own `queries/`, own `interface/events/`   | Pure reads, no invariant-write; safe wherever a predicate is needed.                                                     |

Only `root-ops` crosses the domain boundary. The three constituent op-stereotypes are uniformly domain-private — there is no VO exception.

**Hierarchical composition (decision A-i, resolved):** constituent ops **may compose each other** within `domain/`, so a tree-structured aggregate (root → entity → sub-entity → VO) composes bottom-up without funneling every operation through `root-ops` (which would make `root-ops` unwieldy). dependency-cruiser cannot know the containment tree, so it enforces only "domain-private"; the _direction_ of composition stays a modeling convention, with `no-circular` as the backstop against a backwards containment edge. Residual edge, set aside: a pure display/derivation calc on a VO that a presenter wants belongs in the view/query layer, and a reusable pure predicate is already a `specification` — so gate all VO-ops and treat a genuine "public VO calc" need as the signal to reconsider, not the default.

## Part B — Event reactions as interface adapters

### B1. Fold the reaction into `interface/events/`

ADR-0007 already calls the event adapter "an inbound port — structurally identical to an HTTP endpoint, just on the event-bus transport." Once the reaction is dispatch-only, the reason `event-handlers/` was a separate application-layer folder dissolves. Merge:

**Before**

```
event-handlers/create-wallet-when-organization-is-created.handler.ts   // mutates via WalletRootOps + WalletRepository
event-handlers/triggers/organization.triggers.ts                        // internal trigger type
interface/events/organization.event-adapter.ts                          // subscribe + translate + provide repo to handler
```

**After**

```
interface/events/organization.event-adapter.ts        // subscribe → translate event → dispatch CreateWalletCommand via CommandBus
interface/events/organization.event-adapter.test.ts    // given OrganizationCreated, dispatches CreateWallet{organizationId} (recording bus)
commands/create-wallet.command.ts + .handler.ts + .handler.test.ts   // owns WalletRepository + WalletRootOps + emits WalletCreated
```

- The `event-handlers/` folder and its isolation rules are **removed entirely**.
- The **trigger indirection is eliminated** — the command schema _is_ the internal contract. The ACL guarantee (a foreign field change touches only the adapter) is preserved because the adapter remains the sole importer of the foreign barrel.
- **Same-module reactions unify here too**: billing's `StripeWebhookIngested` subscription (currently inside the handler, no `interface/events/`) becomes `interface/events/stripe-webhook.event-adapter.ts` dispatching a `SyncSubscription` command.

### B2. Adapters are bus-only

Event adapters may import: own `domain/*.events.ts` + `*.id.ts` (to subscribe), own `commands/*.command.ts` (to dispatch), `CommandBus`/`QueryBus`/`DomainEventBus`/`IntegrationEventBus`, foreign barrels (cross-module events, already gated). **Not** `domain/ports/`, **not** `*.root-ops.ts`, **not** infrastructure. This is the same discipline HTTP endpoints already follow.

### B3. Transaction semantics preserved

- **Immediate/atomic** reactions (wallet-on-org-create): adapter subscribes on `DomainEventBus`, dispatches the command in the publisher's fiber; the command's `withUnitOfWork` opens a **nested savepoint** in the ambient transaction, so the wallet write stays atomic with org creation. An uncaught failure rolls the whole thing back — unchanged guarantee.
- **Eventual** reactions: adapter subscribes on `IntegrationEventBus`, dispatched command runs post-commit in its own transaction.

### B4. External-IO reactions (forward-looking — 0 today)

The telemetry/ETL/email case (a reaction that does outbound IO, not a domain mutation). Resolved as a tiered judgment call (decision B-i), captured in the ADR rather than pre-built:

1. **Involves the domain in any way** → dispatch a command; the domain expresses the reaction. (Default.)
2. **Pure side-effect with no domain meaning that always follows the trigger** → don't make it a reaction at all; colocate it in the originating command's handler (e.g. as post-commit work outside the transaction).
3. **Genuine external client** → the client is usually cross-cutting/platform-level, so a command handler calls the platform client port (commands already consume the `Mailer` port).
4. **Narrow possible exception** — a client tightly coupled to a single module that we would not want to re-expose to the originating module. Hard to construct today; **deferred.** `interface/events/` stays strictly bus-only until a real case forces the carve-out — consistent with ADR-0008's "change the design, don't widen the rule."

No migration work today.

## Enforcement changes

### `eslint.project-structure.mjs` (folder taxonomy)

`domain/` children — add:

```
{ name: "*.root-ops.ts",       enforceExistence: "{node-name}.test.ts", message: MSG.rootOpsTest }
{ name: "*.specification.ts",  enforceExistence: "{node-name}.test.ts", message: MSG.specificationTest }
{ name: "*.entity-ops.ts",     enforceExistence: "{node-name}.test.ts", message: MSG.entityOpsTest }
{ name: "*.aggregate-ops.ts",  enforceExistence: "{node-name}.test.ts", message: MSG.aggregateOpsTest }
{ name: "*.value-object-ops.ts", enforceExistence: "{node-name}.test.ts", message: MSG.valueObjectOpsTest }
```

`domain/` `*.root.ts` — **drop** `enforceExistence` (dumb data; the ops file carries the test). Do this only in Phase 4, after all roots are split.

Module children — **remove** the `event-handlers` folder node. `interface/events` node is unchanged (already admits `*.event-adapter.ts` + test).

Didactic messages must steer: the `*.root-ops.ts` message names the mutation boundary; the constituent-ops messages say "reach this only from the root's ops."

### `.dependency-cruiser.cjs` (import graph)

Add:

- **`root-ops-only-from-command-handlers`** — `to` = `domain/*.root-ops.ts`; `from.pathNot` = own `domain/`, own `commands/*.handler.ts`, `*.test.ts`, `*.repository-fake.ts`.
- **`constituent-ops-domain-private`** — `to` = `domain/*.(entity-ops|aggregate-ops|value-object-ops).ts`; `from.pathNot` = own `domain/`, `*.test.ts`. Anything in the module's `domain/` may compose them (hierarchical composition); nothing outside can.
- **`interface-events-isolation`** — positive allowlist (modeled on `commands-isolation`): `interface/events/` may import only own `domain/*.(events|id).ts`, own `commands/*.command.ts`, `platform/ddd/`, `platform/ids/`, and (via existing `foreign-barrel-only-from-outbound-adapter`) foreign barrels.

Change:

- **`outbound-ports-private-to-use-cases`** — remove `event-handlers/` and `interface/events/` from the `pathNot` allowlist. Adapters are bus-only; the folder is gone.

Remove:

- **`event-handlers-isolation`** and **`event-handlers-no-external-beyond-effect`** — folder no longer exists.

Leave: `specification` needs **no** new rule — it lives in `domain/`, which commands/queries/interface-events are already allowed to read; the point is that draining predicates there lets those layers stop importing `*.root-ops.ts`. All three constituent op-stereotypes share the one `constituent-ops-domain-private` rule (no VO exception).

## Test parity flip (Phase 4)

- `*.root.test.ts` (12 files) → renamed/rehomed to `*.root-ops.test.ts` (they test ops).
- New `*.specification.test.ts` for the 3 drained aggregates.
- `*.root.ts` no longer requires a test.

## ADR changes

Decision C-i, resolved: **no new ADR.** These ADRs are a terse snapshot of the system as it currently is (educational repo), not a historical record — so amend the existing ones in place to describe the new reality.

- **ADR-0002** (module layout) — application layer is `commands/` + `queries/` only; event reactions are inbound adapters in `interface/events/`. Remove `event-handlers/` from the layout and its rationale.
- **ADR-0003** (aggregates & ops) — ops split out of `*.root.ts` into `*.root-ops.ts`; root is dumb data; parity on the ops file. Introduce the constituent op-stereotypes, their domain-private privacy rule (hierarchical composition), and the `.specification` stereotype for read-predicates.
- **ADR-0007** (unit of work & event buses) — realize "B's event handler runs B's own command": the reaction is a bus-only adapter that dispatches a command; immediate atomicity via nested savepoint; the tiered external-IO judgment call (B4); the folder move.
- **ADR-0008** (enforcement) — new taxonomy entries + dep rules; `event-handlers-isolation` removed; `interface-events-isolation` and the op-privacy rules added.
- **ADR-0023** (domain services & interface utils) — clarify the `specification` vs `domain-service` boundary (a specification is a pure predicate over one aggregate; a domain service is stateless logic spanning aggregates); note the `RootOps` reference now points at `*.root-ops.ts`.
- **ADR-0024** (filenames) — add `.root-ops`, `.specification`, `.entity-ops`, `.aggregate-ops`, `.value-object-ops` to the vocabulary table; remove the `event-handlers/` row.

## Execution — phased, TDD, pilot-first

Deny-by-default taxonomy means ordering matters: introduce new stereotypes as _allowed_ before requiring them, migrate module-by-module, flip parity last.

**Phase 0 — scaffolding (non-breaking).**

- Add the five new domain stereotypes to `eslint.project-structure.mjs` as _allowed_ kinds (with their `.test.ts` parity). Keep `*.root.ts`'s existing test requirement for now.
- Add the new dep-cruiser rules and `interface-events-isolation`; adjust `outbound-ports-private-to-use-cases`. These are inert until files move.
- `pnpm lint && pnpm lint:deps` stay green (no files match the new stereotypes yet; `event-handlers/` still present, so keep its rule until Phase 2).

**Phase 1 — pilot: wallet, end-to-end.** Wallet is small and exercises the riskiest path (the event-adapter refactor + its first command).

- TDD the new `CreateWallet` command handler (unit test with `WalletRepositoryFake` + `RecordingEventBus`).
- Split `wallet.root.ts` → `wallet.root.ts` + `wallet.root-ops.ts`; move `wallet.root.test.ts` → `wallet.root-ops.test.ts`.
- Rewrite `interface/events/organization.event-adapter.ts` to dispatch `CreateWalletCommand` (test via a recording command bus); delete `event-handlers/` + `triggers/` in wallet; register the command handler in a new `wallet.command-handlers.ts`; update `wallet.module.ts` wiring (adapter now needs `CommandBus`, not the repo).
- Run `pnpm check:all`. **Revise this plan from whatever breaks** before fanning out.

**Phase 2 — billing reaction.** Same shape: new `SyncSubscription` command+handler; `interface/events/stripe-webhook.event-adapter.ts`; delete billing's `event-handlers/`. Then remove `event-handlers-isolation` + the folder node from the taxonomy.

**Phase 3 — fan out the ops split** to the other 11 roots; drain the 3 specification sets (invitation, api-token, organization-roles); repoint their query handlers and repository fakes.

**Phase 4 — flip parity + ADRs.** Drop `*.root.ts`'s test requirement; ensure every ops file has its test; write/amend the ADRs; final `pnpm check:all`.

## Risks & watch-items

- **`check:effect` green** — the split touches many files; keep the yieldable-error / `Effect.fn` idioms intact (CLAUDE.md gate).
- **Nested-savepoint behavior for the immediate wallet reaction** — verify the org-creation integration test still sees wallet-and-org as atomic after the adapter dispatches a command rather than mutating inline.
- **Orphan ops** — `wallet` has `credit`/`debit` ops but no command uses them; they move to `wallet.root-ops.ts` as unused exports (no rule violation, but note it).
- **Cross-schema / barrel rules** unaffected — root-ops is never exported from `index.ts`, so cross-module leakage stays blocked independently.
- **Migration window** — between Phase 1 and Phase 3, migrated modules have `*.root-ops.ts` while others keep ops in `*.root.ts`; both are valid because the new stereotype is _allowed_ and its parity only fires per-file. The `*.root.ts` test requirement stays until Phase 4 so unmigrated roots keep their obligation.

## Pilot findings (Phase 1 complete — wallet, fully green)

The wallet pilot passed the whole gate (lint, lint:deps, typecheck, check:effect, 474 unit + 218 integration tests). What it taught, to apply during fan-out:

1. **Root-parity flip belongs in Phase 0, not Phase 4.** Dropping `*.root.ts`'s test requirement is non-breaking immediately (the existing `*.root.test.ts` files stay valid, just not required) and it unblocks splitting a root without orphaning its test obligation. Done in Phase 0.
2. **`interface-events-isolation` can only land once an adapter is bus-only.** It is not inert on the current tree — it would fail the pre-refactor adapter. Add it per-adapter, right after the refactor (done for wallet; billing follows in Phase 2).
3. **The `subscribe` R=`never` boundary is the load-bearing pattern.** `DomainEventBus.subscribe` requires `(event) => Effect<void, never, never>`, but a dispatched command carries `DomainEventBus | UnitOfWork | Database.Database` in `R`. The adapter provides the two clean platform ports (`DomainEventBus`, `UnitOfWork`) from captured singletons and **elides only the ambient DB-pool Tag** with a documented `as Effect.Effect<void>` cast — guaranteed sound because the immediate bus runs the handler in the publisher's fully-provisioned fiber. This keeps the adapter free of `@org/database`, so `interface-events-isolation` stays strict for every future adapter. Reuse this shape verbatim in the billing adapter.
4. **Test layers for adapters must `provideMerge`, not `mergeAll`.** The adapter now `yield*`s `UnitOfWork`/`DomainEventBus`/`CommandBus` at build time, so a sibling `mergeAll(UnitOfWorkLive, adapter)` leaves those unsatisfied (mergeAll doesn't wire siblings). Chain `provideMerge` so each dep is provided _into_ the adapter and re-exported for the test.
5. **New reusable test seam: `test-utils/recording-command-bus.ts`** (`RecordingCommandBus` + `RecordedCommands`) — asserts which command an inbound adapter dispatches, mirroring `RecordingEventBus`. Use it for the billing adapter unit test.
6. **Import sorter collates `wallet.root.js` _before_ `wallet.root-ops.js`.** When a file imports both the data type and the ops, the data import sorts first. Expect `eslint --fix` to reorder; run it per-file (test files only) to avoid the registry-merge hazard.
7. **Behavior improvement:** the old wallet event-handler silently dropped `WalletCreated` (created `events`, never dispatched). The `CreateWallet` command now dispatches it on fresh insert (idempotent duplicate dispatches nothing). Nothing subscribes to `WalletCreated`, so this is a latent-correctness fix, not a regression.
8. **Orphan ops confirmed:** `credit`/`debit` moved to `wallet.root-ops.ts` but no command uses them (wallet has no credit/debit command). They're unused exports — no rule violation. Flag for the team whether to keep or drop during fan-out.

## Phase 2 findings (complete — billing, fully green)

The billing reaction moved to an `interface/events/stripe-webhook.event-adapter.ts` + a new `SyncSubscription` command; whole gate green (474 unit + 218 integration). Notes:

- **`event-handlers/` is fully retired.** Wallet and billing were the only two; both are now inbound adapters. Removed the `event-handlers` taxonomy node and the `event-handlers-isolation` / `-no-external-beyond-effect` dep rules. A new `event-handlers/` folder is now rejected deny-by-default. Vestigial `event-handlers` mentions remain in three dep-cruiser group regexes (`outbound-ports-private-to-use-cases`, `dumb-repository-live-no-app-collaborators`, `interface-util-files-are-leaves`) — harmless no-ops, cleaned in Phase 4.
- **Same-module reactions unify cleanly.** Billing's `StripeWebhookIngested` (previously subscribed inline in the handler, no `interface/events/`) is now a normal adapter — no billing wiring change at the composition root, because `billingCommandHandlers` was already spread into the bus; the `SyncSubscription` entry just joined it.
- **The adapter is the right home for external-vocabulary translation.** Stripe's `deleted → "canceled"` mapping and the "which event types matter" fan-out live in the adapter; the `SyncSubscription` command is Stripe-agnostic (`{stripeSubscriptionId, status, currentPeriodEnd}`). The repo lookup (`findOneByStripeSubscriptionId`) stays in the command handler (adapter is bus-only).
- **Test split:** the old 6-scenario handler test became a 4-scenario adapter test (translation, via `RecordingCommandBus`) + a 2-scenario command-handler test (mutation + out-of-order no-op). Coverage preserved.
- **Root split deferred to Phase 3.** `subscription.root.ts` was left unsplit here — Phase 2 is purely the reaction refactor; it splits with the other 10 roots in Phase 3. The `SyncSubscription` handler imports `SubscriptionRootOps` from the still-monolithic `subscription.root.ts` (fine — the root-ops gate only applies to `*.root-ops.ts` files).

## Decisions (resolved)

- **A-i** — constituent ops compose each other hierarchically within `domain/`; enforced only as "domain-private", direction is convention + `no-circular`.
- **B-i** — external-IO reactions: tiered judgment call (B4); `interface/events/` stays strictly bus-only for now.
- **C-i** — no new ADR; amend the existing snapshot (0002, 0003, 0007, 0008, 0023, 0024) in place.
- **VO-ops** — gated like all constituent ops (invariant-enforcement stays domain-mediated); no VO exception.
