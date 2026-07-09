# ADR-0021 — Per-route authorization DSL (PolicyRegistry + ResourceResolverRegistry)

Date: 2026-05-19
Status: Accepted

## Context

The auth middleware (ADR-0016) authenticates a request and attaches
`CurrentUser` — `userId` plus an `isSuperAdmin` flag populated by a
one-line `users.role` lookup — to the Effect environment, but performs
no authorization. Authentication alone leaves every endpoint with the
same story: _"must be authenticated."_ Endpoints that introduce a real
privilege distinction — promote / demote to super-admin — need a place
to declare _who_ may invoke them. Two failure modes if we shipped
without a DSL:

1. **Inline `if (!currentUser.isSuperAdmin) ...` in every endpoint.**
   Each endpoint reinvents authz; testing per endpoint is mechanical;
   refactoring the rule requires touching every site.
2. **The future capability-ACL work would appear as a giant rewrite.**
   Without a layer to slot per-grant checks into, the ACL would have to
   invent its own wiring everywhere.

A declarative DSL today gives super-admin endpoints coverage and gives
the future ACL work a stable seam to compose into.

### Prior art

Spring Security's `@PreAuthorize("hasPermission(#id, 'group',
'view')")` annotation, popularised in the Java ACL extension `jaclp`,
captures the shape we want, translated to Effect-TS:

| Spring / jaclp                                      | This codebase                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `@PreAuthorize("hasPermission(#id, R, A)")`         | `yield* Authz.hasPermissions(R, A, id)` piped into the endpoint Effect |
| `PermissionsService` registering `(R, A, callback)` | `PolicyRegistry` typed map keyed by `(R, A)` pairs                     |
| `IResourceRepository.getResource(id)` per type      | `ResourceResolverRegistry` keyed by resource name                      |
| Spring injects the current user                     | `UserAuthMiddleware` already provides `CurrentUser` via Effect env     |
| Callback signature `(UserDetails, ResourceObject)`  | Callback signature `(CurrentUser, Resource) => Effect<boolean, E, R>`  |

No Effect-TS authorization library matches this shape. `@effect/platform`
provides the HTTP primitives (HTTP-API middleware, endpoint annotations)
but no registry or resolver layer. Existing TS-ecosystem options
considered:

- **CASL.** Closest JS match, but defaults to _session-baked_
  abilities. Rebuilding the ability per-request uses ~30% of the
  library and forces a non-Effect adapter surface throughout the
  codebase. Crucially, session-baked permissions don't fit the wider
  product requirement that a newly-invited member gains access without
  re-authenticating.
- **Casbin.** Adds a `.conf` policy model on top of code — a second
  authoring surface. Powerful, but a poor demo for the patterns this
  codebase teaches.
- **Cerbos / Oso / Cedar.** Full policy engines, separate process or
  separate language. Overkill for this codebase.

A hand-rolled DSL is ~150 LOC of new code, stays Effect-native, and
folds in cleanly with the existing typed-bus dispatch.

## Decision

### One method, jaclp-shaped

Endpoints call exactly one platform function:

```ts
yield * Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
```

- **Resource** is a name like `"user"` keyed into `ResourceResolverMap`.
- **Action** is one of `Actions.{Create, Read, Update, Delete}` —
  the platform-wide CRUD vocabulary.
- **id** is required for resource-scoped actions
  (READ/UPDATE/DELETE), forbidden for CREATE. The variadic-tuple type
  on the third arg gives `Expected 3 arguments, but got 2` if you
  forget the id, which is clearer than the `not assignable to never`
  that function overloads would produce.

### Actions are CRUD; business operations live in commands

Two endpoints that both UPDATE a user — promote-to-super-admin and
demote-from-super-admin — share the same `(user, update)` policy
entry. The bespoke "promote" vs "demote" distinction belongs in the
command/aggregate, not in the action vocabulary. Bespoke action names
proliferate fast (`promote`, `demote`, `archive`, `restore`,
`approve`, …) and force every reader to learn the per-resource verb
table.

When two operations on the same `(resource, action)` need _different_
authz outcomes (e.g. anyone can self-demote, only super-admins can
self-promote), the rule that distinguishes them is a _domain
invariant_, not an authz rule. It lives in the command. The
canonical example shipping with this ADR: `user.update` policy is
`any(SuperAdminOnly, IsSelf)`; the "no self-promote" rule lives in
the promote-to-super-admin command as a `CannotPromoteSelf` failure,
which the endpoint translates to a 403 with a distinct message.

### Two declaration-mergeable registries

Mirroring the existing typed CommandBus / QueryBus pattern:

- **`ResourceResolverMap`** maps a resource name → `{ idType,
resourceType }`. Each module declares its entries via TypeScript
  declaration merging in its per-module policies file.
- **`PolicyMap`** maps resource → action → check. Same declaration-
  merge pattern, nested shape mirrors the (resource, action) split.

Registration values can be a single check or `ReadonlyArray<Check>`.
Arrays are AND-composed at registration time (every check must
return true, short-circuits on the first false). For OR composition,
wrap with `Check.any(...)`. Stacking reads naturally:

```ts
update: [SuperAdminOnly, NotRecentlyPromoted]; // AND
update: any(SuperAdminOnly, IsSelf); // OR
```

### Checks are Effects returning boolean, not void + Forbidden

`Check<Caller, Resource, E, R>` is
`(caller, resource) => Effect<boolean, E, R>`. The boolean shape lets
checks compose via `any` / `all` before the final lift to `Forbidden`
at the `Authz.hasPermissions` boundary. Each check can read from the
Effect environment (DB, repositories, the bus) freely.

`SuperAdminOnly` is the baseline policy:

```ts
const SuperAdminOnly: Check<CurrentUser["Type"], unknown> = (caller) =>
  Effect.succeed(caller.isSuperAdmin);
```

It ignores the resource argument, so it composes with any
resource-typed check via `any` / `all`.

### Resolver loads the resource per request, not at session start

When a resource-scoped action is invoked with an `id`, the framework
calls the registered resolver, hands the loaded resource to the
check, and propagates `NotFound` in the error channel for the
endpoint to translate. No caching. This is the property that makes
"user X gets a new privilege and immediately exercises it" work
without re-authentication: the per-request lookup sees the new state
the moment it exists.

When the registered check doesn't need the resource (`SuperAdminOnly`
on any action), the endpoint can omit the id and skip the DB load.
The type system enforces this — `id` is optional only for
READ/UPDATE/DELETE, forbidden for CREATE.

### Wiring respects the composition-root rule

Each module's policies file exposes its contributions as plain data
(a `PolicyContribution` object) and its resource resolver as a
factory function taking the relevant repository. The composition
root builds the registries from those contributions and provides
them as Layers alongside the existing bus layers. The
`lives-only-from-composition-roots` dep-cruise rule continues to
hold.

Module-private repositories that need to be referenced by the
composition root (the user-resource-resolver factory needs the
`UserRepository`) ship as a narrowly-scoped `<module>SharedDepsLive`
Layer — the same shape that auth's shared deps Layer already uses.
Module barrels remain barrel-content-discipline compliant.

## Consequences

### Positive

- One mechanism, one shape. Every endpoint that needs authz reads the
  same: `Authz.hasPermissions(R, A[, id])`. New endpoints don't
  reinvent.
- Per-request resource resolution gives multi-context access changes
  immediately, no session refresh.
- Future capability-ACL work plugs in as one more registered check
  (`MemberHasGrant("...")`). The wiring already exists.
- Super-admin bypass is just a registered `SuperAdminOnly` baseline
  composed via `Check.any` — no special-cased middleware short-
  circuit.

### Negative / trade-offs

- The CRUD-only action vocabulary forces a layering decision: when a
  business rule discriminates within UPDATE (e.g. self-promote
  forbidden), that rule MUST live in the command, not the policy. New
  contributors will hit this when introducing nuanced rules; the
  promote-to-super-admin / `CannotPromoteSelf` flow is the canonical
  example to reach for.
- The variadic-tuple type for the third arg is unusual in TypeScript
  authz libraries; readers familiar with overload-style APIs need a
  moment to recognize the optional/forbidden id semantics.
- Errors thrown by Authz (`Forbidden`, `NotFound`) must appear in the
  endpoint's contract error union. Today they are added per endpoint;
  if the surface grows we may extract a group-level addition.

### Out of scope (intentionally deferred)

- **OpenAPI annotation surfacing.** Endpoint annotations could carry
  the `(resource, action)` pair onto the OpenAPI spec for doc-gen.
  Deferred until the contract export work matures.
- **Per-request audit log.** `Authz.hasPermissions` already opens a
  span (`authz.hasPermissions.<resource>.<action>`); structured audit
  logging on top of that is a follow-up.
- **Capability-ACL grants.** This ADR establishes the seam; the
  per-grant lookup check and the grants table land with a future ADR.

## Alternatives considered

- **CASL.** See Context. Rejected for the session-baked default.
- **Casbin.** Rejected for the second authoring surface.
- **Cerbos / Oso / Cedar.** Rejected as overkill.
- **`Authz.requires` and `Authz.requiresOn` as two separate methods.**
  A previous iteration. Replaced by a single `hasPermissions` to
  match jaclp's vocabulary exactly and reduce surface area.
- **Per-resource action enums** (e.g. `UserActions.PromoteToSuperAdmin`).
  Tried briefly; rejected because business operations don't belong in
  the authz vocabulary. Same complaint as bespoke action strings.

## Related

- ADR-0002: hexagonal module layout — the boundary modules contribute
  policies and resolvers across.
- ADR-0006: typed CommandBus / QueryBus — the declaration-merge
  pattern this ADR mirrors.
- ADR-0007: synchronous event bus + interface/events ACL — a peer
  cross-module seam.
- ADR-0008: dep-cruiser enforcement of the boundary rules this ADR
  works inside of.
- ADR-0016: authentication via self-hosted Zitadel — the identity
  source `CurrentUser` is fed from.
