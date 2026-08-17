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
- **Action** is one of `Actions.{Create, Read, Update, Delete}` — this
  application's declared vocabulary, which the DSL takes as given rather
  than defines.
- **id** is decided by the resource, not the action. The variadic-tuple
  type on the third arg gives `Expected 3 arguments, but got 2` if you
  forget it, which is clearer than the `not assignable to never`
  that function overloads would produce.

### Scopedness is a property of the resource, not the action

An earlier iteration keyed scopedness to the action: CREATE was "flat"
(id forbidden, checks see only the caller) and READ/UPDATE/DELETE took
an **optional** id. Both halves were wrong, and each produced a
workaround that had to be removed:

- **Optional id made the check's parameter type a lie.** A check
  declared `resource: R` but received `undefined` whenever a call site
  omitted the id, so a resource-scoped check had to defend against a
  missing resource with a runtime cast, and an unscoped call site had
  to collapse an unreachable `NotFound` to a defect.
- **Flat CREATE could not express "create within a container."** The
  overwhelmingly common create is scoped to a parent — a todo in an
  organization. With no id available, the endpoint had to call the
  composed check directly, beside the registry: no span, no
  registration, and an authorization decision inlined in an endpoint.

The rule is now: a resource registered in `ResourceResolverMap` is
**scoped** — every action on it requires an id, and its checks always
receive the resolved resource. A resource absent from that map is
**unscoped** — no action on it takes an id, and its checks only ever
see the caller. A "create in this container" is a scoped action on the
container resource. `FlatAction` no longer exists, and a check can no
longer be handed `undefined`.

Two things follow from making this a resource property. A caller-only
check is declared at the narrower one-parameter arity, so one instance
composes into both tiers — TypeScript accepts a fewer-parameter
function wherever a more-parameter one is expected, never the reverse.
And an unscoped resource's error channel omits `NotFound` entirely,
because nothing is resolved.

### Resolver fallibility is declared, not assumed

Taking an id and being able to fail are separate axes. A resource whose
identity _is_ its id — an "echo" resolver with nothing to load — takes
an id but can never report absence, so `NotFound` sat unreachably in
every one of its call sites' error channels, and each defended against
it with a dead branch.

A resource therefore declares whether resolving it can report absence. An
echo declares `notFound: never`, which removes `NotFound` from every
caller's channel. The dead branches are not merely deleted — they become
unrepresentable.

Absence is the only axis the resource declares. The transient-store
signal rides in every resolver's channel unconditionally, echo or not, for
the same reason a policy check carries it: authorization reads the store
twice — once to resolve the resource, once inside the check — and both
reads face the same outage. A resolver that demoted it to a defect would
report a retryable outage as a 500 while the identical outage one step
later produced a 503, making the status a caller sees depend on which of
two adjacent reads happened to reach the store first. The boundary that
translates it to a status is the endpoint, and it can only see a failure.

### This application's actions are CRUD; business operations live in commands

The vocabulary is declared by this application, not by the DSL — the library
takes whatever union the host names, so a different application is free to model
per-resource verbs or a richer set. What follows is this application's choice.

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

The command/query buses originally used this pattern and have since
dropped it: a dispatched message carries its own signature, so the
registry there was a second declaration of facts the message already
held (ADR-0006). Authorization is not analogous. A resource name is
not a value anyone dispatches — it is a string literal in an endpoint
naming a resource whose id and resolver types live in another module —
so there is no message to read the signature off. The registries stay
here for that reason, not for symmetry:

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

A check is `(caller, resource) => Effect<boolean, …>`. The boolean shape
lets checks compose via `any` / `all` before the final lift to
`Forbidden` at the `Authz.hasPermissions` boundary.

### Registered checks are fully closed — an empty requirement channel

An earlier iteration let a check read whatever it needed from the Effect
environment, and the registry named the closed set of services it could
reach. That coupled every check to every service: each check's
requirement channel declared the whole set whether it used it or not, so
every policy unit test in every module had to stub services the check
never touched, and the cost grew with modules × capabilities.

A check now takes its data source as an **argument** and the module's
contribution closes over it at registration, so every registered check
has an empty requirement channel. Consequences:

- The registry holds no ambient service requirements, and a policy unit
  test provides nothing at all.
- Because the closing happens inside a Layer, a module's contribution is
  effectful: it is published behind a Tag whose Layer yields that
  module's own ports, mirroring how resource resolvers are already
  published. The composition root yields each Tag and hands the values
  to the registry.
- A dependency that used to be an implicit environment requirement is now
  an explicit Layer edge the composition root can see.

Where a check's data belongs to another bounded context, the argument is
the module's own outbound ACL port (ADR-0022); where it is the module's
own data, the argument is a function the contribution builds by
dispatching the module's own query. There is no platform-level
authorization service — see ADR-0022 for why that tier was withdrawn.

### Resolver loads the resource per request, not at session start

When a resource-scoped action is invoked with an `id`, the framework
calls the registered resolver, hands the loaded resource to the
check, and propagates `NotFound` in the error channel for the
endpoint to translate. No caching. This is the property that makes
"user X gets a new privilege and immediately exercises it" work
without re-authentication: the per-request lookup sees the new state
the moment it exists.

A check whose decision does not involve the resource belongs on an
unscoped resource, which takes no id and performs no load — see
"Scopedness is a property of the resource" above.

The resolver reads a **read model**, never an aggregate. Handing an
aggregate root to a check is content coupling: the authorization rule
becomes breakable by an aggregate refactor with no authorization
content, and a check gains reach it should not have. Where the load
exists only to distinguish "no such resource" from "not permitted", the
projection is as small as the id itself.

Note what per-request resolution now rests on: reads join the caller's
ambient transaction, so this is only immediate while the read path stays
synchronous and same-database. A query backing an authorization decision
must never be served from a replica or a projection — see ADR-0022.

### Shipped as a standalone package

The DSL lives in a standalone package, since published and consumed here as
`@effect-server-utils/authz` at an exact beta. Its only dependency is Effect. Nothing else about the decisions above changes: the two
declaration-merged registries, the resource-decides-the-id rule, the CRUD
vocabulary, and the fully-closed checks are the package's own design.

What the split forces into the open is everything the DSL is written against but
does not own. There are five, and each was previously named directly: the caller
identity, what a check or a resolver may fail with, how a resolver reports
absence, the vocabulary of actions, and the error a denial becomes. A library
that names any of them is not a library. Four are this application's session
shape, its persistence vocabulary, and two HTTP statuses, so the first consumer
with a different transport would have to fork it. The fifth is worse, because it
is not a technical coupling at all: shipping CRUD inside the mechanism would
impose an authorization taxonomy on every consumer, and the argument for CRUD
made above is a modelling decision this application reached, not a property of
registries and resolvers.

The four types arrive as one augmented interface the host declares once — the
same mechanism the two registries already use, which is what keeps the surface
uniform rather than adding a second style of configuration. They are not generic
parameters because the registries are themselves declaration-merged: a module
writes a check type for a resource name at the type level, with no value to
infer from, so parameters would have to be restated at every registration site
instead of decided once. The action slot left unconfigured is `string`, which
constrains nothing; declaring it is what turns a shared vocabulary into
something the compiler holds every resource to.

The fifth is a value the library constructs, so it arrives as a constructor
passed where the endpoint-facing function is built. It takes the caller's
identity key alongside it, which is also what puts that key — and nothing more
— in the returned function's requirement channel. Both fields are supplied as
Effects rather than as a key and an error value, because a service key and a
yieldable error already are Effects: the host writes the same two expressions it
would have written inline, and the denial type is inferred rather than declared
a second time.

Two consequences. The library compiles against empty registries, where every
resource type collapses to nothing — so a handful of assertions that are
load-bearing in a host's program read as redundant when the package is linted
alone. And a host's type-level configuration has to be present in every
TypeScript program that names a check, which is a property of module
augmentation generally, not of this design: a test program that includes only
test files needs the configuring file added to it explicitly.

### Wiring respects the composition-root rule

Each module publishes its policy contribution and its resource
resolvers behind Tags. The composition root yields those Tags, builds
the two registries, and provides them alongside the bus layers. Both
registries dispatch queries, so both sit in the step that receives the
buses.

A module's outbound ACL adapter cannot be closed inside the module — it
needs the buses, which only the composition root has — and it lives in
`infrastructure/`, which `barrel-content-discipline` forbids a barrel
from re-exporting. It therefore ships as a named module-root bundle, the
same shape already used for a module's endpoint-consumed services. The
composition root provides the opaque bundle; the port Tag stays private
to the module. `lives-only-from-composition-roots` continues to hold,
and module barrels stay barrel-content-discipline compliant.

## Consequences

### Positive

- One mechanism, one shape. Every endpoint that needs authz reads the
  same: `Authz.hasPermissions(R, A[, id])`. New endpoints don't
  reinvent.
- Per-request resource resolution gives multi-context access changes
  immediately, no session refresh.
- Future capability-ACL work plugs in as one more registered check
  (`MemberHasGrant("...")`). The wiring already exists.
- Super-admin bypass is just another registered check composed via
  `Check.any` — no special-cased middleware short-circuit. Each module
  owns its own, asking the role module through its own ACL port, so no
  module carries a platform-level authorization dependency (ADR-0022).

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
  the authz vocabulary. Same complaint as bespoke action strings. Rejected for
  this application only — the vocabulary is a host declaration, so nothing in
  the DSL stands in the way of an application that wants them.

## Related

- ADR-0002: hexagonal module layout — the boundary modules contribute
  policies and resolvers across.
- ADR-0006: typed CommandBus / QueryBus — where a check's own data
  comes from, and why the buses no longer use the declaration-merged
  registry these authz registries still do.
- ADR-0007: synchronous event bus + interface/events ACL — a peer
  cross-module seam.
- ADR-0008: dep-cruiser enforcement of the boundary rules this ADR
  works inside of.
- ADR-0016: authentication via self-hosted Zitadel — the identity
  source `CurrentUser` is fed from.
