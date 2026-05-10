# ADR-0019 — Isomorphic stack commitment

Date: 2026-05-10
Status: Accepted

## Context

The template runs Effect + TypeScript on both sides of the wire:

- The server (`@org/server`) terminates HTTP, persists to Postgres,
  composes business logic via the command/query/event buses.
- The web renderer (`@org/web`) is a Next.js App Router app that
  proxies `/api/*` to the BFF, renders server components from a
  per-request runtime, and hydrates a client runtime that shares the
  same `ApiClient` type.

The contract package `@org/contracts` is the single source of truth
for API shape, schemas, and the error union. Both server and web
build against the same `HttpApi` definition; the server implements
it, the web client consumes it.

This isomorphism is load-bearing for a testing tier we want to
introduce (Phases 7–9 of the frontend testing remediation plan):
**integration tests that run the real backend handlers in-process
from FE tests**. That tier is only possible because the backend code
is callable as a function from a Node-side test process. If the
backend lived in a different runtime (Go, Rust, JVM), we'd be stuck
with a hand-written simulator that drifts from the real handlers, or
we'd give up the tier entirely.

The isomorphism deserves an explicit commitment so future
contributors see the constraint and the rationale before proposing a
polyglot backend.

## Decision

**Commit to an isomorphic stack: any backend service whose web tier
has integration tests must run in the Node runtime and expose its
HTTP request handler as a function callable from a workspace
package.**

In practice today:

- The BFF (`@org/server`) is Node + Effect + `@effect/platform`.
  Its `HttpApi.toHandler(Api)` produces a `(Request) => Promise<Response>`
  that's already shaped for in-process invocation.
- The contract package compiles to plain ESM and is depended on by
  both packages without any code-gen step.
- The web renderer's `ApiClient` is a `Context.Tag` whose live layer
  is parameterized by transport. Production wires it to `fetch`
  against `/api/...`; the integration tier wires it to a
  `fetch`-shaped function that resolves inside the process via
  `HttpApi.toHandler(Api)`.

New backend services authored in another runtime forfeit the
integration tier for their FE surface. They keep the presenter tier
and the acceptance tier; they lose the in-process tier.

## Consequences

- **Locked to Node + TypeScript on the backend** until this ADR is
  revised.
- In return:
  - **No OpenAPI codegen.** The contract is the schema. There's no
    second tool to drift against.
  - **No schema duplication.** Server and web build against the same
    `Schema.Class`/`HttpApi` definitions.
  - **No parallel fakes.** The FE-side integration tests use the
    real backend handlers; the simulator IS the backend.
  - **Branded domain types flow end-to-end** without translation.
    `UserId` is a branded string in `@org/server` and a branded
    string in `@org/web`; same brand, same nominal type.
  - **`TestClock` / `RecordingEventBus` / FakeDatabase work
    identically** on both sides — they're Effect services, and the
    FE-side test harness consumes them via the same `Context.Tag`s
    the server-side tests do.
- **Future extraction.** If a future module is extracted to a
  non-Node service (Go, Rust, Python ML service, etc.), that
  module's FE-side integration tests drop to one of:
  - An MSW-stateful simulator with contract-test parity against
    the real service.
  - The acceptance tier only (Playwright + the real deployed
    service).

  The presenter tier and the acceptance tier are unaffected. The
  pain is local to the extracted module.

## Alternatives considered

- **Polyglot stack with hand-written FE-side simulators.** Rejected.
  The simulator drifts from the real handler unless its contract
  tests are exhaustive (they're never exhaustive). Drift produces
  the classic "tests pass, prod fails" failure mode.
- **WASM-compile the backend for in-process use.** Rejected. Loading
  a WASM blob into Node, threading Postgres bindings through it,
  and reproducing the Effect runtime inside WASM is a tar pit. The
  ergonomic gap vs. native Node is large enough that maintenance
  cost dominates.
- **Skip the integration tier entirely.** Rejected. The gap is
  exactly the one the remediation plan exists to close: presenter
  tests over-mock; acceptance tests are too slow and stateful for
  every behavior the FE depends on; integration is the missing rung.
- **Generate a TypeScript client from an OpenAPI document.**
  Rejected on its own merits: the Effect contract already produces
  a typed client (`HttpApiClient.make(Api)`). Layering OpenAPI on
  top would introduce a translation step in the source of truth.

## Mechanics

- The `test-backend` workspace package (added in Phase 8 of the
  remediation plan) is the in-process surface: `TestBackend.start()`
  returns a handle with a `fetch`-shaped function backed by
  `HttpApi.toHandler(Api)`, plus direct programmatic access to the
  FakeDatabase, TestClock, RecordingEventBus, and per-external-service
  simulators.
- The web `ApiClient` accepts a swappable transport tag. Production
  uses `fetch`; tests use the `fetch` returned by `TestBackend.start()`.

## Related

- ADR-0010 (HTTP-only contracts) — the contract package is the
  single source of truth for API shape.
- ADR-0018 (Next.js renderer + proxy) — the web tier's runtime
  shape and how it proxies `/api/*`.
- Frontend testing remediation plan, Phases 7–9 — the integration
  tier this ADR enables.
