# ADR-0012: Observability — use-case `Effect.fn` spans + first-party OTLP export

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

A production system without observability is one you can only debug from logs someone thought to write before the incident. Effect's runtime supports first-class structured tracing, and Effect v4 ships a first-party OTLP tracer that exports spans to any OTLP-compatible collector. The marginal cost of adding tracing from the start is small; the cost of adding it during an incident is enormous.

The forces:

- Every meaningful unit of work — an HTTP request, a use case, a repository call — should produce a trace span. Spans nest naturally; a trace for a request should show HTTP → use case → repository → SQL as a tree.
- Trace propagation across in-process operations should be automatic. Manual context-passing for traces produces fragmentary traces that miss the interesting causal links.
- A span should carry the identity and source location of the code that produced it, so a span in the collector points back at the function that emitted it.
- Application-level correlation (request id, authenticated user id) is a _separate_ concern from trace propagation. OpenTelemetry trace ids are correct for "show me this request's trace"; they are not correct for "show me every event caused by user X." Both are useful, and the architecture distinguishes them.
- Local development should require minimal setup to see traces.

## Decision

### Span discipline — boundary spans plus a use-case span, no finer

Spans live at architectural boundaries **and** at each use-case handler; nowhere finer.

The boundary spans:

- **HTTP (and CLI) endpoints** span each operation. The endpoint adapter declares its boundary span by being written as `Effect.fn("<GroupLive.op>")` (e.g. `UserHttp.create`) — the v4 idiom, and what `@effect/language-service`'s `effectFnOpportunity` diagnostic steers toward — rather than a trailing `Effect.withSpan`.
- **The command bus** spans every dispatch: `command:<CommandTag>` with attribute `command.tag`.
- **The query bus** spans every dispatch: `query:<QueryTag>` with attribute `query.tag`.
- **The domain event bus** spans every event: `domainEvent:<EventTag>` with attributes `event.tag` and `event.handler.count`.
- **Repository methods** span each method: `<Repository>.<method>`.

Every use-case handler — command, query, and event handlers — is declared with `Effect.fn("<handlerName>")`, which names a span for the handler body itself, nested _inside_ the bus/endpoint boundary span and _above_ the repository-method spans:

```
command:CompleteTodoCommand      (bus boundary)
└─ completeTodo                  (use case)
   └─ TodosRepository.updateOne  (repository)
      └─ <SQL>
```

The use-case span carries the function identity and source location — information the bus tag (a data label derived from the command's `_tag`) does not. When a handler does several things — mutate an aggregate, then dispatch domain events — those become children of the handler's own span rather than siblings under the bus tag, so the causal tree matches the handler body. Coverage is not a convention that can be forgotten: the file-taxonomy lint (ADR-0008) already requires every handler to exist as a named stereotype with a sibling test, and the `Effect.fn` declaration is part of how a handler is written.

**Granularity rule.** Instrument at use-case granularity and no finer. A handler's span plus the retained repository/bus/endpoint spans is the whole story; do not open spans for private sub-steps. Where a use case delegates to a shared internal helper (e.g. the API-token mint core reused by the mint use case and the device-grant poll), the helper stays span-less so its `Effect.annotateCurrentSpan` calls land on whichever use case invoked it. A shared helper acquiring its own span would be instrumentation below use-case granularity — a speculative-generality smell.

### Span attributes — sibling extractor functions composed at registration

Commands, queries, and domain events are plain `Schema.TaggedStruct` data — not class instances — so the wire format and the in-memory format are the same shape. This matters because events have realistic serialization pressure (outbox tables, message queues), where any "did I remember to decode this?" foot-gun translates to dropped observability the moment a worker reads a row as raw JSON.

Span-attribute extraction is a sibling concern. Each command/query/event file exports both the schema and a `<name>SpanAttributes(value) => attrs` function next to it; the function returns only fields its author has audited as non-PHI/non-PII. The two are composed at registration:

- For commands and queries, each registry entry has the shape `{ handle, spanAttributes? }`. The bus reads both: `handle` produces the work, `spanAttributes` produces the attribute map merged into the bus-level span. Omitting it emits only the tag attribute.
- For domain events, subscribers register independently of definitions, so the registry is a separate `eventSpanAttributes({ ... })` map per module, merged at server-wiring time and passed to the domain-event bus Live. The bus dispatches by `_tag` and looks up the matching extractor.

Values _generated_ mid-handler (e.g. a freshly created user id) are attached with `Effect.annotateCurrentSpan`, which now annotates the handler's own use-case span. This shape was chosen over a method on a class: a `toSpanAttributes()` method on a `Schema.TaggedClass` disappears the moment something reads a JSON row without decoding through Schema. Plain structs plus sibling extractors eliminate that whole category of error.

### Export — first-party OTLP tracer

The server exports via Effect v4's first-party OTLP tracer (from its observability module): a tracer layer that batches ended spans and POSTs them JSON-serialized to the OTLP `/v1/traces` endpoint, over a fetch-based HTTP client. The browser tracer is the same — `web-sdk.client.ts` provides `OtlpTracer.layer` (over `FetchHttpClient` + `OtlpSerialization.layerJson`) into the client `ManagedRuntime`. The browser keeps Effect's `HttpClient` trace propagation enabled, so a browser span propagates `traceparent` on `/api/*` fetches; the Next server disables Effect propagation and lets `@vercel/otel` (the Next-server Node tracer) own it, and Jaeger stitches browser → Next → BFF into one trace. The collector URL is environment-configured; local development runs Jaeger via `docker-compose`. Tracing rides entirely on the `effect` package — no `@effect/opentelemetry` or OpenTelemetry JS SDK on the server.

### Two kinds of correlation

The platform exports a `RequestContext` `FiberRef` for application-level correlation (request id, authenticated user id, trace id), distinct from OpenTelemetry's trace propagation:

- **OpenTelemetry trace id** is automatic via the runtime and links spans across handlers, repositories, and SQL within a single fiber tree — the right mechanism for "show me this request's trace."
- **Application-level correlation** belongs in domain events and structured logs so a downstream consumer can attribute an event to the originating user or request. The `RequestContext` `FiberRef` is the carrier. It is defined; stamping domain events with `correlationId`/`causationId` from it is a known extension point, so "query for all events caused by user X" is answered by joining trace context today.

## Consequences

- Every code path is observable end-to-end without ad hoc logging. A trace for a failed request shows which use case ran, which repository call failed, and the cause — with a source location on the use-case span.
- The causal tree matches the handler body rather than flattening under the bus tag.
- Span cardinality is roughly one per handled operation above the bus posture; sampling at the batch exporter is the lever if it becomes a concern.
- The bus tag attributes (`command.tag`, `query.tag`, `event.tag`) are still emitted, so nothing that queried on them regresses.
- Dependency on a local Jaeger instance for the development experience. Acceptable for the workflow value.

## Alternatives considered

- **Bus-boundary-only spans (no use-case span).** Rejected — the flattened causal tree and the missing source location are real losses, and v4 makes the use-case span free at the point of declaration (`Effect.fn`), with coverage guaranteed independently by the handler-stereotype lint (ADR-0008).
- **Instrument below use-case granularity** (spans on domain ops, shared helpers, private sub-steps). Rejected — speculative generality; it inflates cardinality and couples the trace shape to internal factoring that carries no operational meaning.
- **Move the span into the bus wrapper** (bus opens a span named after the handler). Rejected — the bus only knows the command tag, not the handler's identity or source location, which is exactly what the use-case span adds.
- **`toSpanAttributes()` method on each command/query/event class.** Rejected — making the schemas classes creates a dichotomy at any serialization boundary; plain structs plus sibling extractors are the same property without the foot-gun.
- **Vendor-specific tracing SDK.** Rejected — OTLP is the lingua franca; vendor lock-in at this layer is unnecessary.

## Related

- ADR-0007 (synchronous dispatch) — what makes event-handler and subscriber spans appear under their publisher's trace.
- ADR-0008 (file-taxonomy enforcement) — the handler-stereotype discipline that upholds use-case span coverage.
