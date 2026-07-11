# ADR-0023: Domain services and interface utility helpers

- Status: Accepted
- Date: 2026-07-02

## Context and Problem Statement

Two genuinely distinct gaps in the stereotype vocabulary — one in the domain, one in the interface layer — need filling, rather than a single "misc helper" category that the folder-layout allowlist (ADR-0008) would otherwise reject with no sanctioned home.

**Gap 1 — shared domain logic with no aggregate home.** `hashToken` (sha256-hex a credential) was defined in a file named after API tokens, but it is applied to API-token secrets, device-grant codes, _and_ an arbitrary incoming bearer in the auth middleware, where there is no aggregate instance at all. It encodes a real bounded-context rule — "auth credentials are stored and compared by their hash, never in plaintext" — that belongs to no single aggregate. Folding it onto one aggregate's `RootOps` would force the other aggregate and the middleware to reach into that aggregate arbitrarily. The codebase had no stereotype for "stateless domain logic that spans aggregates."

**Gap 2 — shared, testable protocol plumbing in an interface adapter.** The OIDC login/callback endpoints share two pure helpers: `buildCallbackUrl` (reconstructs the absolute `redirect_uri` around Next's `/api` rewrite) and the PKCE cookie codec (`encode/decodePkcePayload` + the cookie name/TTL). Both were extracted deliberately, to unit-test fiddly, security-relevant logic without a live OIDC client or HTTP runtime; the cookie codec is additionally the shared contract between the endpoint that sets the cookie and the one that reads it. Neither is domain logic — they manipulate HTTP request artifacts and OIDC protocol state, which by ADR-0016/0017 must stay out of the (provider-agnostic) domain. The interface layer had no stereotype for a shared helper beyond endpoints and the group `-live.ts`.

The risk in filling either gap is convention drift — a generic "utils allowed" escape hatch that an agent (or a rushed human) uses to smuggle logic past the architecture. The two gaps also carry _different_ risk profiles, which the solution reflects.

## Decision

### Domain services — `*.domain-service.ts`

A **domain service** is a sanctioned domain stereotype: stateless domain logic that no single aggregate owns. It lives in `domain/domain-services/`, is a pure free-function module (matching the `XRootOps` free-function-bag style — the ops that live in an aggregate's `*.root-ops.ts` — _not_ an injected `Context.Tag`; there is nothing to configure or fake for a pure function), and carries a test obligation.

Because `domain/` is organized into subdomain folders that are isolated from one another (ADR-0003), a domain service is also the one domain location permitted to **compose more than one subdomain** — the orchestration seam among aggregates inside the bounded context. `invitation-acceptance` (organization module) composes the invitation and membership subdomains: accepting an invitation makes the invitee a member. Neither aggregate owns that rule, and subdomain isolation forbids the invitation subdomain from importing the membership subdomain (or vice versa), so the composition lives in `domain/domain-services/invitation-acceptance.domain-service.ts`.

`hashToken` becomes `CredentialHash.of` in `credential-hash.domain-service.ts`. The API-token wire format (`assembleToken`, `displayPrefix`) folds onto `ApiTokenRootOps` (in `api-token.root-ops.ts`) and the user-code format (`toUserCode`) onto `DeviceGrantRootOps`, because those _are_ their aggregates' own concerns — only the cross-cutting hash graduates to a service.

**The guard against anemia.** Domain services are the most-abused DDD stereotype — a dumping ground that hollows out aggregates. The rule: a `*.domain-service.ts` is only for logic that genuinely has _no aggregate home_. Logic that operates on or produces one aggregate stays on that aggregate's `*.root-ops.ts` bag. `hashToken` qualifies (cross-aggregate + applied to raw lookup input); `assembleToken`/`toUserCode` explicitly do not.

**Specification vs. domain service.** A `*.specification.ts` (ADR-0003) and a `*.domain-service.ts` are both pure free-function bags in `domain/`, but they answer different questions. A specification is a **predicate or derivation over a _single_ aggregate** — `isExpired(token, now)`, `isOpen(workOrder)` — read-only, emitting nothing; being read-only, it is importable from `queries/` and the `interface/events/` adapters as well as the domain. A domain service is **stateless logic that spans aggregates or has no single aggregate home** — `CredentialHash.of`, applied to raw lookup input across API tokens, device grants, and an incoming bearer. The test is ownership: if the logic reads one aggregate, it is that aggregate's specification (or, if it mutates, an op on its `*.root-ops.ts`); if it belongs to none, it is a domain service.

**Purity still splits it.** Credential _hashing_ is pure → domain service. Credential _generation_ is impure (randomness) and stays in the command (the shell), exactly as `mint-api-token` and `start-device-grant` already do — the domain never generates entropy. This is why the shared `invitation-token` generator was _inlined_ into its two commands rather than promoted to a service: it is pure entropy with no domain-specific format to model.

### Interface utilities — `*.util.ts`

A `*.util.ts` is a pure, leaf, shared protocol/wire helper in an interface adapter. It is allowed **only in `interface/http/` and `interface/cli/`** — and deliberately **nowhere else**.

The scope is the whole point. Risk is layer-dependent:

- In `interface/`, a helper is protocol/wire adaptation _by the nature of the layer_; dependency rules already bar domain/application logic from living there. Low risk.
- In the application layer (`commands/`, `queries/`), a shared pure helper is a _smell_ — it is almost always either domain logic that should be an aggregate op, or trivial enough to inline. Allowing a util there would be a backdoor around the domain.

So the application layer gets **no** util escape hatch. A shared helper there stays a hard build failure, which surfaces anemic-domain pressure instead of hiding it. `domain/`, `infrastructure/`, and `interface/events/` likewise admit no utils.

Two guards keep `*.util.ts` from drifting even within the interface layer:

1. **Test-obligated** — every `*.util.ts` requires a sibling `*.util.test.ts`. The bar for extracting a helper is "justify it with a unit test," which is exactly what distinguishes a deliberate extraction from a dumped utility.
2. **Leaf-only** — a dependency-cruiser rule forbids a `*.util.ts` from importing ports, use cases, infrastructure, the buses/unit-of-work, or a module barrel. It stays mechanical plumbing; it cannot orchestrate or reach persistence.

## Enforcement

- Folder-structure rule layout (ADR-0008): `*.domain-service.ts` is in the `domain/domain-services/` allowlist; `*.util.ts` is in the `interface/http` and `interface/cli` allowlists only.
- Folder-structure rule parity: `*.domain-service.ts` → `*.domain-service.test.ts`; `*.util.ts` → `*.util.test.ts`.
- Dependency-cruiser: `interface-util-files-are-leaves` enforces the leaf constraint. Domain services need no new rule — `domain-isolation` + `domain-no-external-beyond-effect` already govern them (`node:crypto` is a core module, exempt); and `subdomain-isolation` (ADR-0008) excludes `domain/domain-services/` from its `from`, which is what lets a domain service import more than one subdomain.

## Consequences

- The auth bounded context's "credentials are compared by hash" rule has one named, tested, discoverable home, and the middleware + both device-grant commands import a _service_ rather than a hash from a file named after API tokens.
- The vocabulary gains exactly what it needed without loosening into a junk drawer: one new domain stereotype (added consciously, tested) and one tightly-scoped interface convention.
- The application layer is provably free of shared-helper escape hatches — a design pressure, not just a guideline.
- Cost: two more sanctioned suffixes and their parity/dep rules. The domain-service stereotype must be policed against anemia in review; the "no aggregate home" test is the standard to apply.

## Alternatives considered

- **Fold `hashToken` onto `ApiTokenRootOps`.** Rejected. It is used by device-grant and the middleware too; making them import ApiToken's ops for a generic hash is arbitrary ownership.
- **Model the credential as a value object.** Reasonable, but `hashToken` is applied to a _raw lookup input_ (the incoming bearer) with no credential instance, so an operation/service reads more honestly than wrapping every call site in a VO.
- **Make credential generation a domain service too.** Rejected. Generation is impure (randomness); a domain service that generates entropy reintroduces the functional-core violation the codebase keeps in the shell.
- **Allow `*.util.ts` across all shell folders.** Rejected. The application layer is exactly where a "shared helper" masks anemic domain logic; denying utils there is a forcing function, not a limitation.
- **A single "shared helper" stereotype for both gaps.** Rejected. Domain logic and interface plumbing are different layers with different risks; one suffix would blur the line the whole layout system exists to draw.

## Related

- ADR-0001 (functional core / imperative shell) — why credential generation (impure) stays in the command and only pure logic is domain.
- ADR-0003 (aggregates) — `XRootOps` in `*.root-ops.ts`, the free-function-bag style domain services mirror; and `*.specification.ts`, the read-only single-aggregate predicate a domain service is contrasted against.
- ADR-0016/0017 (Zitadel BFF) — why OIDC protocol state is interface-layer, not domain.
- ADR-0008 (architecture enforcement) — the folder-structure layout/parity machinery these two stereotypes extend.
- ADR-0022 (adapter taxonomy) — the clients/acl tiering alongside which these interface/domain stereotypes sit.
