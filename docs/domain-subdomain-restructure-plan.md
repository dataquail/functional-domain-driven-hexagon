# Plan: Subdomain subfolders within `domain/`

Status: DONE — fully green (lint, lint:deps, tsc, check:effect, 477 unit, 218 integration)
Related ADRs: 0002, 0003, 0005, 0008, 0009, 0022, 0023, 0024 (all amended)

## Outcome (complete)

Executed as planned: D1 (invitation→membership domain service) first, then parallel per-module agents moved every domain into subdomain folders, then the config rewrite (taxonomy container + `subdomain-isolation` + depth-adjusted op/repository rules), then the ADR amendments. Decisions taken: D1 domain service, D2 uniform subfoldering, D3 own subfolder for repository-only subdomains (`auth-identity`, `webhook-event`), D4 infrastructure stays flat, D5 parallel agents.

**The `subdomain-isolation` rule earned its keep immediately** — it caught two genuinely mis-homed types the plan's up-front scan missed (they were `@/`-alias / cross-tier edges, not the `./` relatives scanned): `AuthIdentityNotFound` living in `session.errors.ts` (→ moved to `auth-identity/auth-identity.errors.ts`) and `StripeWebhookEvent` living in the billing-gateway **client port** (→ moved to `webhook-event/stripe-webhook.value-object.ts`, a domain value object the port now imports). Both fixed by relocating the type to the subdomain that owns it.

One enforcement gap found and fixed: the `dumb-repository-ports` eslint glob (`eslint.config.mjs`) still pointed at `domain/ports/repositories/` and had to be re-scoped to `domain/*/*.repository.ts`.

## Why

A module's `domain/` is currently flat: every aggregate's files (root, ops, specification, errors, events, id, value objects) sit side by side. In `organization/domain/` that means four distinct subdomains — `organization`, `invitation`, `membership`, `organization-roles` — intermingled with no boundary between them. Nothing stops one subdomain reaching into another's internals.

Group each module's `domain/` into **per-subdomain subfolders**, make the subdomains isolated from one another, and give domain services a dedicated home as the one sanctioned place where subdomains meet.

## Target structure (organization module as the worked example)

```
modules/organization/
  domain/
    organization/            # subdomain folder
      organization.root.ts
      organization.root-ops.ts   (+ .test.ts)
      organization.specification.ts (+ .test.ts)
      organization.errors.ts
      organization.events.ts
      organization.repository.ts        # ← the repository PORT moves in
    invitation/
      invitation.root.ts / .root-ops.ts / .specification.ts / .errors.ts / .events.ts
      invitation.repository.ts
    membership/
      membership.root.ts / .root-ops.ts / .errors.ts / .events.ts
      membership.repository.ts
    organization-roles/
      organization-roles.root.ts / .root-ops.ts / .specification.ts
      organization-role.value-object.ts / .errors.ts / .events.ts
      organization-roles.repository.ts
    domain-services/         # the ONLY non-subdomain, non-ports content in domain/
      invitation-acceptance.domain-service.ts (+ .test.ts)   # (see decision D1)
    ports/                   # stays at domain root; repositories/ removed
      clients/   *.client.ts
      acl/       *.acl.ts
  commands/ queries/ infrastructure/ interface/ policies/   # unchanged
```

- `domain/` root admits **no direct files** — only the subdomain folders, `domain-services/`, and `ports/`.
- Repository **ports** (`*.repository.ts`) move from `domain/ports/repositories/` into their subdomain folder. `domain/ports/` keeps `clients/` and `acl/` only.
- Repository **implementations** (`infrastructure/repositories/*.repository-live|fake|mapper.ts`) stay flat in `infrastructure/` — this restructure is domain-only (see decision D4).

## Subdomain inventory (by aggregate root / repository)

| Module       | Subdomain folders                                                                                  | Domain services              |
| ------------ | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| role         | `roles` (incl. `role.value-object/errors/events`)                                                  | —                            |
| organization | `organization`, `invitation`, `membership`, `organization-roles` (incl. `organization-role.*`)     | `invitation-acceptance` (D1) |
| auth         | `api-token`, `session`, `device-grant`, `auth-identity` (repo-only)                                | `credential-hash` (hoisted)  |
| user         | `user` (incl. `value-objects/address.value-object`)                                                | —                            |
| todos        | `todo`                                                                                             | —                            |
| billing      | `subscription`, `webhook-event` (repo + `webhook-event.errors` + `stripe-webhook.events`, no root) | —                            |
| wallet       | `wallet`                                                                                           | —                            |

**Naming:** the subdomain folder is named for the aggregate root concept; files keep their current names (so `role.value-object.ts` lives in `roles/`, `organization-role.*` in `organization-roles/`, `stripe-webhook.events.ts` in `webhook-event/`). No file renames.

## The one isolation violation to resolve (decision D1)

A full cross-domain import scan found exactly one genuine cross-subdomain edge: **`invitation.root-ops.ts` imports `membership.root`/`membership.root-ops`** — `InvitationRootOps.accept` marks the invitation accepted _and_ produces a `MembershipRoot` (+ its events), because "the only way to consume an invite is to become a member." Subdomain isolation forbids this edge. Two ways to resolve it:

- **D1a (recommended): a domain service.** `organization/domain/domain-services/invitation-acceptance.domain-service.ts` imports both the `invitation` and `membership` subdomains and exposes `accept(invitation, input) → { invitation, membership, events }`. `InvitationRootOps.accept` slims to mark-accepted-only (invitation subdomain, no membership). The `accept-invitation` command handler calls the domain service. This matches the stated model: domain services are the orchestration layer among subdomains, and "accepting an invite makes you a member" is a domain rule spanning two aggregates.
- **D1b: application orchestration.** The `accept-invitation` command handler calls `InvitationRootOps.accept` (invitation-only) and `MembershipRootOps.create` separately and dispatches both event sets. No domain service; the coordination lives in the use case. Leaves `domain-services/` empty in organization.

Every other flagged edge was a false positive (same subdomain, prefix variance): `roles↔role`, `organization-roles↔organization-role`, `user↔value-objects/address`.

## Isolation rules (the enforced boundary)

- A file in `domain/<subA>/` may import only its own subdomain (`domain/<subA>/`), `effect`, `platform/ddd/contracts/`, and `platform/ids/`. It may not import another subdomain, `domain/domain-services/`, or `domain/ports/`.
- A file in `domain/domain-services/` may import any subdomain in the same module (`domain/<any>/`) plus the same externals — it is the one domain location allowed to cross subdomains. Dependency runs domain-service → subdomains (one-way); subdomains never import domain services.
- Command handlers, queries, interface, and infrastructure are outside `domain/` and may consume multiple subdomains as today (they are the use-case/adapter layers) — isolation is a domain-internal rule only.

## Enforcement changes

### `eslint.project-structure.mjs` (folder taxonomy)

- `domain/` becomes a **container**: children are `domain-services/` (named), `ports/` (named), and `*` (a catch-all subdomain folder). No direct files at `domain/` root.
- Subdomain folder (`*`) admits the current domain stereotypes — `*.root.ts`, `*.root-ops.ts` (+test), `*.specification.ts` (+test), `*.aggregate.ts`/`.entity.ts`/`.value-object.ts` + their `*-ops.ts` (+tests), `*.id.ts`, `*.errors.ts`, `*.events.ts`, a nested `value-objects/` folder, tests — **plus** `*.repository.ts` (the port; parity → `infrastructure/repositories/`). It does **not** admit `*.domain-service.ts`.
- `domain-services/` admits only `*.domain-service.ts` (+ `*.domain-service.test.ts`).
- `ports/` admits only `clients/` and `acl/` (drop `repositories/`).
- Repository-port parity path changes: from a subdomain folder it resolves `../../infrastructure/repositories/` (one level shallower than the old `domain/ports/repositories/`). clients/acl parity paths under `domain/ports/` are unchanged.
- A subdomain folder with only a repository (`auth-identity`, `webhook-event`) is valid — root/ops parity only fires when those files exist.

### `.dependency-cruiser.cjs`

- **New** `subdomain-isolation`: `from` a subdomain folder (`domain/<sub>/`, excluding `domain-services/` and `ports/`), `to` a different subdomain → forbidden (same-subdomain allowed via the `$1` backreference). Domain services are excluded from `from`, so they may cross.
- **Depth +1 on existing domain-path rules** (a subdomain segment is inserted): `root-ops-only-from-command-handlers` (`domain/[^/]+/[^/]+\.root-ops\.ts`), `constituent-ops-domain-private` (same for entity/aggregate/value-object-ops), `interface-events-isolation` (its allowlisted `domain/*.(events|id).ts` becomes `domain/[^/]+/[^/]+\.(events|id)\.ts`).
- `outbound-ports-private-to-use-cases`: its `to` target adds the subdomain repository ports — `domain/ports/` (clients/acl) **and** `domain/[^/]+/[^/]+\.repository\.ts`.
- `domain-isolation` / `domain-no-external-beyond-effect` are prefix-based (`domain/`) and keep working unchanged; they cover domain-services too.

## Execution approach

Mirrors the Phase-3 fan-out that worked well: this is mostly mechanical file moves plus a large but regular within-module import repoint (every domain-file path gains a subdomain segment; external modules are unaffected because they import through the barrel).

1. **Resolve D1 first** (the invitation→membership decoupling) so the `invitation` and `membership` subdomains are already isolation-clean before the move.
2. **Per-module parallel agents** move each module's domain files into subdomain folders (incl. the repository port from `ports/repositories/`), repoint within-module imports (`domain/X.js` → `domain/<sub>/X.js`), update the module barrel, and `eslint --fix` for import sort. Each module is self-contained (external importers use the barrel).
3. **I rewrite the config** (taxonomy + dep-cruiser) — this is all-or-nothing (the container-domain rule only passes once every module is subdomained), so it lands with the moves.
4. **One gate at the end** (`lint`, `lint:deps`, `tsc`, `check:effect`, unit, integration). Adjust from fallout.
5. **Amend ADRs** 0002 (domain layout: subdomain folders + domain-services/ + ports/), 0003 (stereotypes grouped per subdomain), 0008 (taxonomy + new subdomain-isolation rule), 0022/0023 (repository port location; domain services as the cross-subdomain seam).

## Decisions to confirm

- **D1** — invitation→membership: **domain service** (recommended) or command-handler orchestration?
- **D2** — single-aggregate modules (role, user, todos, wallet): **uniform subfoldering** (recommended — one clean container rule, e.g. `user/domain/user/`) or leave them flat (a special case in the taxonomy)?
- **D3** — repository-only subdomains (`auth-identity`, `webhook-event`): give each **its own subfolder** holding just the port (+ errors/events) — recommended — or park them elsewhere?
- **D4** — keep `infrastructure/` **flat** (recommended; the ask is the domain port move) or mirror the subdomain split there too (future option)?
- **D5** — execution: **parallel per-module agents** (recommended, as in Phase 3) or sequential?

## Risks

- Largest import-repoint yet (every domain file moves), but purely mechanical and within-module; the barrel absorbs external churn.
- The config change is all-or-nothing, so the tree is red mid-flight until every module is moved — validated by the single end-gate (uncommitted WIP, as with Phase 3).
- The `value-objects/` nested folder and the mixed-prefix files (`role.*` in `roles/`, `organization-role.*` in `organization-roles/`, `stripe-webhook.events` in `webhook-event/`) are kept as-is to avoid a rename storm; the taxonomy allows them.
