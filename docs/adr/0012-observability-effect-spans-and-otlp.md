# ADR-0012: Observability — Effect spans + OTLP export

- Status: Accepted
- Date: 2026-04-24 (revised 2026-04-25: span discipline moved from per-handler to bus boundaries; span attributes attached via sibling extractor functions composed at registration time, not via methods on class instances)

## Context and Problem Statement

A production system without observability is a system you can only debug from logs that someone thought to write before the incident. Effect's runtime supports first-class structured tracing (`Effect.withSpan`), and `@effect/opentelemetry` exports those spans to any OTLP-compatible collector. The marginal cost of adding tracing from the start is small; the cost of adding it during an incident is enormous.

The forces:

- Every meaningful unit of work — an HTTP handler, a use case, a repository call, a query — should produce a trace span. Spans nest naturally; a trace for a request should show the path through use case → repository → SQL query as a tree.
- Trace propagation across in-process operations should be automatic. Manual context-passing for traces is a recipe for fragmentary traces that miss the interesting causal links.
- Application-level correlation (request id, authenticated user id) is a _separate_ concern from trace propagation. OpenTelemetry trace ids are correct for "show me this request's trace"; they are not correct for "show me every event caused by user X across logs and event records." Both kinds of correlation are useful, and the architecture should distinguish them.
- Local development should require minimal setup to see traces. A developer who can't see what their code did is a developer who falls back to printf-debugging.

## Decision

### Span discipline

Spans live at architectural boundaries, not on every function. The boundaries that produce a span:

- **HTTP handlers** wrap each operation: `<Module>.<operation>` (e.g. `UserHttpLive.create`).
- **The command bus** spans every dispatch: `command:<CommandTag>` with structured attribute `command.tag`.
- **The query bus** spans every dispatch: `query:<QueryTag>` with structured attribute `query.tag`.
- **The domain event bus** spans every event it dispatches: `domainEvent:<EventTag>` with attributes `event.tag` and `event.handler.count`.
- **Repository methods** wrap each method: `<Repository>.<method>` (e.g. `UserRepository.insert`).

Spans nest naturally via Effect's runtime, so a trace shows the HTTP request → bus dispatch → repository call → SQL query as a single tree. Use cases and event handlers do not need their own `Effect.withSpan` because the bus span already names the unit of work; their internal repository calls become children of the bus span. A handler with non-trivial internal sub-steps can still attach `Effect.annotateCurrentSpan` or open ad-hoc child spans where useful — the rule is that bus-boundary instrumentation is guaranteed, not that handlers are forbidden from instrumenting further.

Placing instrumentation at the bus rather than on every handler means coverage is structural: forgetting `Effect.withSpan` on a new use case is impossible because the use case never runs outside the bus.

### Span attributes — sibling extractor functions composed at registration

Commands, queries, and domain events are plain `Schema.TaggedStruct` data — not class instances — so the wire format and the in-memory format are the same shape. This matters because events specifically have realistic serialization pressure (outbox tables, message queues), where any "did I remember to decode this?" foot-gun translates to dropped or corrupted observability the moment a worker reads a row as raw JSON. Plain data has one mental model across producer, dispatcher, and any future serialization boundary.

Span-attribute extraction is a sibling concern. Each command/query/event file exports both the schema and a `<name>SpanAttributes(value) => attrs` function next to it; the function returns only fields its author has audited as non-PHI/non-PII. The two are composed at registration time:

- For commands and queries, each registry entry has the shape `{ handle, spanAttributes? }`. The bus reads both off the entry: `handle` produces the work, `spanAttributes` produces the attribute map merged into the bus-level span. Omitting `spanAttributes` is the safe default — only the tag attribute is emitted.
- For domain events there is no "handler entry" because subscribers register independently of definitions, so the registry is a separate `eventSpanAttributes({ ... })` map per module, merged at server-wiring time and passed to `makeDomainEventBusLive({ spanAttributes })`. The bus dispatches by `_tag` and looks up the matching extractor.

The redaction logic still lives in the schema's defining file (sibling export, same module ownership). Composition happens at the seam where the value meets the bus, exactly once. For values _generated_ mid-handler (e.g. the new user id in `createUser`), the handler attaches them via `Effect.annotateCurrentSpan` — sibling extractors cover inputs the schema's author vouched for, annotation covers what's discovered during execution.

This shape was deliberately chosen over a method on a class. Classes (`Schema.TaggedClass`) would carry the method intrinsically with the instance, which is slightly more cohesive in-process but creates a class-instance-vs-plain-data dichotomy that bites at every serialization boundary — the moment something reads a JSON row from an outbox without decoding through Schema, the methods are gone. Plain structs eliminate that whole category of error at the cost of a one-time-import per registration site.

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
- Use case and event handler coverage is structural: it cannot be forgotten because the bus is the only entry point.
- The trade for that guarantee is one less named middle span per request. A trace shows `command:CreateUserCommand` rather than `createUser`; the command tag carries the same information and is also exposed as a structured attribute.
- Domain events do not carry `correlationId` or `userId` today. The OpenTelemetry trace id still links the spans correctly because synchronous event subscribers run in the publisher's fiber (ADR-0007). The gap is at the application-data level: "I want to query for all events caused by user X" is not currently answerable without joining against another data source.

## Follow-ups

- Wire the `RequestContext` `FiberRef` from an HTTP middleware so request id and authenticated user id are populated on entry. Once populated:
  - Stamp domain events with `correlationId` and `causationId` in the event-bus dispatch wrapper before they reach subscribers.
  - Include the same fields in structured log records.

## Alternatives considered

- **Manual `console.log` and ad hoc trace ids.** Rejected — relies on having logged the right thing at the right level before the bug; gives up causal linking across operations.
- **Vendor-specific tracing SDK** (e.g. directly to a single APM vendor). Rejected — OTLP is the lingua franca for trace export; vendor lock-in at this layer is unnecessary.
- **Spans only at HTTP handler boundaries.** Rejected — coarse spans hide the interesting structure (which repository call is slow? which use case retried?).
- **A `withSpan` on every use case and event handler.** Initially adopted, then refined: bus-boundary spans give the same trace tree (use case body becomes the bus span; repository calls remain child spans) without the convention burden, and remove the gap that a missing `Effect.withSpan` on a new handler created.
- **A `toSpanAttributes()` method on each command/query/event class.** Briefly implemented. Reverted because making the schemas classes (`Schema.TaggedClass`) created an awkward dichotomy at any serialization boundary: a row read from JSONB without decoding through Schema is a plain object, not an instance — the method silently disappears. Plain `TaggedStruct` data plus sibling extractor functions composed at registration is the same architectural property (type's defining file owns its redaction) without that foot-gun.
- **Wire the `RequestContext` and stamp events now, before any concrete need has surfaced.** Considered. Deliberately deferred: the schema for what belongs on the envelope (correlation, causation, authenticated user, tenant, etc.) is easier to design once a real consumer needs it. Until then, the `FiberRef` is a placeholder.

## Related

- ADR-0007 (synchronous dispatch) — what makes subscriber spans appear under their publisher's trace.
