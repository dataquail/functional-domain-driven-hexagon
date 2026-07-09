# ADR-0030: Adopt Effect v4 (`effect-smol`)

- Status: Accepted
- Date: 2026-07-08

## Context and Problem Statement

The monorepo was built on `effect@3.x` plus a set of `@effect/*` companion packages
(`@effect/platform`, `@effect/platform-node`, `@effect/cli`, `@effect/opentelemetry`,
`@effect/vitest`). Effect v4 (`effect-smol`) is a ground-up repackaging of the ecosystem:
the companion packages are absorbed into a single `effect` package under `effect/unstable/*`
subpaths, the whole thing is aggressively tree-shakeable (a minimal program is a few KB
gzipped), and several core APIs are redesigned. As an example/showcase repository, staying
on the modern line is itself a goal — the codebase exists to demonstrate current idiom, not
to freeze on a version.

The cost is that v4 is, at time of writing, a beta. The APIs under `effect/unstable/*` are
explicitly allowed to break on minor releases. So the decision is not only _whether_ to
adopt v4 but _how_ to insulate the codebase from beta churn while doing so.

## Decision

Move the entire monorepo (`contracts`, `database`, `server`, `jobs`, `cli`, `mcp`,
`api-client`, `web`, `components`, `acceptance`) to `effect@4.0.0-beta.94`, dropping the
absorbed companion packages. The migration ran as one long-lived branch: the single
workspace-wide `effect` override flips everyone at once (there is no per-package version
split, because `contracts` exports Schema types the other packages consume, and a v4
`Schema` type is not identical to a v3 one), then green was restored in topological
dependency order, proving the mapping on one thin end-to-end module (`wallet`) before
fanning out.

### Version pinning and the unstable-module policy

Pin the **exact** beta — `4.0.0-beta.94`, not a `beta` range. A version bump is a
deliberate, isolated change, never something that rides in transitively. This matters more
than usual because the code depends on `effect/unstable/*` modules (`effect/unstable/http`,
`effect/unstable/httpapi`, `effect/unstable/cli`, `effect/unstable/observability`), whose
surface may break between betas. The exact pin is what makes the build reproducible; the
pin is the insulation.

`import * as X from "effect/X"` deep-import style is retained — the `effect` `exports` map
resolves it, so the migration did not force a switch to barrel imports.

### The `Either` → `Result` idiom change (domain core)

v4 has no `effect/Either`; its place is taken by `effect/Result`. This touches the domain's
core idiom: aggregate operations return `Result<Outcome, DomainError>` where they returned
`Either` before. The constructor and matcher names change (`left`/`right` →
`fail`/`succeed`, `Either.match({onLeft,onRight})` → `Result.match({onFailure,onSuccess})`).
One consequence worth calling out: v4's `Effect.gen` does **not** adapt a yielded `Result`
(its iterator is distinct from Effect's), so a domain `Result` consumed inside a handler is
lifted explicitly with `Effect.fromResult(...)`. Four domain roots that already exported a
local type named `Result` (the op's success payload) renamed it to `Outcome` to avoid
shadowing the imported module.

### Errors and services

- **Errors:** `Schema.TaggedError` → `Schema.TaggedErrorClass` (a pure rename; same call
  shape). The `Schema.TaggedError` idiom from ADR-0004 is otherwise unchanged.
- **Services:** the `Context.Tag`/`Effect.Service` class forms converge on
  `Context.Service<Self, Shape>()("Id")`, which is now only the key — the bundled
  `effect:`/`accessors:`/`.Default` conveniences are gone. A service defines a `make`
  effect and an explicit `Layer`. This composes cleanly with the hexagonal ports/lives
  separation (ADR-0007): a port is a `Context.Service` key whose `Live` is a separate
  layer wired at the composition root.

### The HTTP API is a redesign, not a rename

`effect/unstable/httpapi` and `effect/unstable/http` replace `@effect/platform/HttpApi*`
and `@effect/platform/HttpServer*`, and the serve model changed shape:

- `HttpApiBuilder.layer(Api)` registers the group handlers into an `HttpRouter`;
  `HttpRouter.serve(appLayer, { middleware })` serves it. CORS and logging are composed as
  `HttpMiddleware` functions in the serve `middleware` argument rather than as dedicated
  builder layers.
- **Endpoint definitions** moved from a fluent chain (`.addSuccess`/`.setPayload`/
  `.addError`) to an options object (`{ success, payload, params, query, error }`); the
  request keys are `params` (path) and `query` (querystring). A group's `.middleware(M)`
  now applies only to the endpoints present when it is called, so it must come **after**
  all `.add(...)` — placing it first silently attaches auth middleware to zero endpoints.

Two runtime behaviors of the new stack are load-bearing and were not obvious from the types:

- **`HttpApiClient` encodes a `Schema.Class` payload/params/query strictly.** A plain object
  that is structurally identical to the class is accepted by the compiler but throws at
  encode time — only a class **instance** passes. Every client call site therefore
  constructs the contract class (`new SomeContract.CreatePayload({...})`). The alternative,
  making request schemas `Schema.Struct`, was rejected: `Schema.Class` lets the class name
  double as its decoded type (`payload: SomeContract.CreatePayload` as a _type_), an
  ergonomic the codebase relies on that `Schema.Struct` does not provide.
- **A `Schema.Void` success responds `200`, not `204`.** v3 defaulted empty-body success to
  `204 No Content`; v4 returns `200`. Only assertions that pinned the exact status needed
  updating.

### Request-scoped services provided post-serve, not via `provideRequest`

An endpoint handler's runtime dependencies are tracked by `HttpApiBuilder` as request-scoped
requirements and are only satisfiable **after** `HttpRouter.serve` unwraps them into plain
requirements. For the app-wide services (buses, unit of work, registries, database, env)
this is straightforward: they are `Layer.provide`d onto the served app.

The subtle case is a service a **module owns internally** yet an **endpoint consumes** — the
OIDC client (auth), the invitation mailer (organization), the billing gateway (billing),
each reached by a handler either directly or through the typed command bus. The natural-
looking tool, `HttpRouter.provideRequest(layer)` inside the module Live, **type-checks but
does not work at runtime**: it installs a context-keyed router middleware whose key never
lands in the context where `HttpApiBuilder` registers the routes, so the service is absent
when the handler runs (a "Service not found" defect) even though the requirement appeared
satisfied. Because these endpoints exercise a real database, the gap was invisible to the
type checker and to the no-database gate; it surfaced only under the integration suite.

The resolution: each such module publishes its endpoint-consumed dependency as an **opaque
bundled layer** (`AuthHttpDepsLive`, `OrganizationHttpDepsLive`,
`BillingHttpDeps{Live,Fake}`), and the composition root provides it **post-serve**, exactly
like the other app services. The underlying port Tag stays module-private — the composition
root sees only the bundle. Billing's production-vs-fake gateway swap ships as the two
bundles (replacing the earlier two-module-Lives approach), so the `BillingGateway` Tag still
never leaves the module (ADR-0023 outbound-port privacy holds).

### Observability

The span discipline and OTLP export changes that v4 enabled are recorded separately in
ADR-0029 (use-case-level `Effect.fn` spans; first-party OTLP tracer replacing
`@effect/opentelemetry`), which supersedes ADR-0012.

## Consequences

- The entire dependency graph rides on the single `effect` package plus
  `@effect/platform-node` and `@effect/vitest`; `@effect/platform`, `@effect/cli`,
  `@effect/opentelemetry`, and the OpenTelemetry JS SDK set are gone from the server.
- The domain's result idiom is `Result<Outcome, DomainError>`. Any new aggregate op returns
  `Result`; handlers lift it with `Effect.fromResult` when consuming it inside `Effect.gen`.
- `effect/unstable/*` may break on a beta bump. The exact pin protects the build until a
  bump is chosen deliberately; a bump is its own reviewed change with its own green gate.
- Endpoint-consumed, module-owned services are provided **post-serve** as opaque bundles,
  never via `HttpRouter.provideRequest`. This is the standing pattern for the "module owns
  it, an endpoint needs it" shape under v4.
- `HttpApiClient` call sites construct contract class instances; contributors adding a call
  wrap the payload/params/query in its contract class.

## Alternatives considered

- **Stay on v3.** Rejected: the repository's purpose is to showcase current idiom, and v4
  is where the ecosystem is going. The tree-shaking and single-package consolidation are
  real wins for an example codebase.
- **Track the `beta` dist-tag instead of an exact pin.** Rejected: with `effect/unstable/*`
  free to break between betas, a floating tag makes the build non-reproducible and turns
  every install into a potential silent breakage. The exact pin is the whole insulation
  strategy.
- **Make contract request schemas `Schema.Struct` to sidestep strict client encoding.**
  Rejected: it would forfeit the class-name-as-type ergonomic and change the exported type
  surface across every consumer. Constructing the class at the call site is local and
  preserves the contract shape.
- **Keep `HttpRouter.provideRequest` for module-owned endpoint dependencies.** Rejected: it
  does not work at runtime with `HttpApiBuilder`'s group indirection. The post-serve opaque
  bundle achieves the same encapsulation with the mechanism that actually delivers the
  service.

## Related

- ADR-0004 (errors as tagged types) — the `Schema.TaggedError`/`TaggedErrorClass` idiom.
- ADR-0007 (unit-of-work boundary, two buses, ports vs. Lives) — the ports/lives separation
  the `Context.Service` pattern composes with, and the composition-root wiring that now
  provides the post-serve request-scoped bundles.
- ADR-0023 (cross-module outbound ports) — the outbound-port privacy the billing/auth/org
  bundles preserve.
- ADR-0029 (use-case spans, first-party OTLP) — the observability half of the v4 adoption.
