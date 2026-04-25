# ADR-0012: Observability — Effect spans + OTLP export

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

A production system without observability is a system you can only debug from logs that someone thought to write before the incident. Effect's runtime supports first-class structured tracing (`Effect.withSpan`), and `@effect/opentelemetry` exports those spans to any OTLP-compatible collector. The marginal cost of adding tracing from the start is small; the cost of adding it during an incident is enormous.

The forces:

- Every meaningful unit of work — an HTTP handler, a use case, a repository call, a query — should produce a trace span. Spans nest naturally; a trace for a request should show the path through use case → repository → SQL query as a tree.
- Trace propagation across in-process operations should be automatic. Manual context-passing for traces is a recipe for fragmentary traces that miss the interesting causal links.
- Application-level correlation (request id, authenticated user id) is a _separate_ concern from trace propagation. OpenTelemetry trace ids are correct for "show me this request's trace"; they are not correct for "show me every event caused by user X across logs and event records." Both kinds of correlation are useful, and the architecture should distinguish them.
- Local development should require minimal setup to see traces. A developer who can't see what their code did is a developer who falls back to printf-debugging.

## Decision

### Span discipline

- Every command, query, HTTP handler, and repository method wraps its body in `Effect.withSpan("<name>")`. Spans nest naturally via Effect's runtime, so a trace shows the HTTP request → command bus → use case → repository call → SQL query as a single tree.
- Span naming convention:
  - HTTP handlers: `<Module>.<operation>` (e.g. `UserHttpLive.create`).
  - Use cases: `<verb><Aggregate>` (e.g. `createUser`).
  - Repository methods: `<Repository>.<method>` (e.g. `UserRepository.insert`).

### Export

The server boots with `NodeSdk.layer(...)` configured with a `BatchSpanProcessor` and an `OTLPTraceExporter`. The collector URL is environment-configured.

Local development runs a Jaeger instance via `docker-compose`, providing a UI for inspecting recent traces.

### Two kinds of correlation

The platform exports a `RequestContext` `FiberRef` for application-level correlation (request id, authenticated user id, trace id). It is distinct from OpenTelemetry's trace propagation:

- **OpenTelemetry trace id** is automatic via the runtime and links spans across handlers, repositories, and SQL queries within a single fiber tree. It is the right mechanism for "show me this request's trace."
- **Application-level correlation** belongs in domain events and structured logs so that a downstream consumer can attribute an event to the originating user or request. The `RequestContext` `FiberRef` is the carrier for this metadata.

The `FiberRef` is defined and ready to use; it is not yet populated by an HTTP middleware. Until it is, domain events do not carry application-level correlation. This is a known gap, tracked in the follow-ups below.

## Consequences

- Every code path is observable end-to-end without ad hoc logging. A trace for a failed HTTP request shows which use case ran, which repository call failed, and the failure cause.
- Span proliferation cost is low. Sampling can be configured at the batch processor if cardinality becomes a concern.
- Dependency on `@effect/opentelemetry` and a local Jaeger instance for the development experience. Acceptable for the workflow value.
- Span names are not currently enforced by tooling. A new use case that omits `Effect.withSpan` simply doesn't show up in traces. A lint check is reasonable future work; today it relies on convention.
- Domain events do not carry `correlationId` or `userId` today. The OpenTelemetry trace id still links the spans correctly because synchronous event subscribers run in the publisher's fiber (ADR-0007). The gap is at the application-data level: "I want to query for all events caused by user X" is not currently answerable without joining against another data source.

## Follow-ups

- Wire the `RequestContext` `FiberRef` from an HTTP middleware so request id and authenticated user id are populated on entry. Once populated:
  - Stamp domain events with `correlationId` and `causationId` in the event-bus dispatch wrapper before they reach subscribers.
  - Include the same fields in structured log records.
- Consider a lint check (or a small static analysis script) that fails the build if a use-case file lacks `Effect.withSpan`.

## Alternatives considered

- **Manual `console.log` and ad hoc trace ids.** Rejected — relies on having logged the right thing at the right level before the bug; gives up causal linking across operations.
- **Vendor-specific tracing SDK** (e.g. directly to a single APM vendor). Rejected — OTLP is the lingua franca for trace export; vendor lock-in at this layer is unnecessary.
- **Spans only at HTTP handler boundaries.** Rejected — coarse spans hide the interesting structure (which repository call is slow? which use case retried?).
- **Wire the `RequestContext` and stamp events now, before any concrete need has surfaced.** Considered. Deliberately deferred: the schema for what belongs on the envelope (correlation, causation, authenticated user, tenant, etc.) is easier to design once a real consumer needs it. Until then, the `FiberRef` is a placeholder.

## Related

- ADR-0007 (synchronous dispatch) — what makes subscriber spans appear under their publisher's trace.
