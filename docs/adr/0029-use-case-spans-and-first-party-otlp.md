# ADR-0029: Use-case-level spans via `Effect.fn`, and first-party OTLP export

- Status: Accepted
- Date: 2026-07-08
- Supersedes: ADR-0012

## Context and Problem Statement

ADR-0012 established the observability posture: Effect spans exported over OTLP to a
collector (Jaeger in local development), with span discipline deliberately confined to
architectural boundaries — the command/query/domain-event buses and the HTTP endpoints.
Use cases and event handlers were intentionally left without their own span. Two forces
drove that choice at the time:

- **Convention burden.** Requiring an `Effect.withSpan` on every handler meant every new
  use case carried a manual instrumentation step that could be forgotten. A forgotten
  span is a silent observability gap, discovered only during an incident.
- **Coverage guarantee.** Because a use case only ever runs _through_ a bus, a
  bus-boundary span made coverage structural: it could not be forgotten, and the bus tag
  (`command:CreateUserCommand`) already named the unit of work.

The trade ADR-0012 accepted was "one less named middle span per request": a trace showed
`command:CreateUserCommand` rather than `createUser`, and a handler that did several
things internally (mutate an aggregate, then dispatch events) attached those child spans
directly under the bus tag, flattening the causal structure of the handler body.

Two things changed that make the trade worth revisiting:

- **Effect v4 makes named spans first-class and cheap.** `Effect.fn("name")(function* …)`
  is the idiomatic way to _write_ a handler in v4 — it replaces the
  `(args) => Effect.gen(function* …)` form outright. The span is not an extra step bolted
  onto the handler; it is a property of how the function is declared. Adopting it costs
  nothing beyond choosing the idiom.
- **The forgotten-span gap closed independently.** The file-taxonomy lint (ADR-0028)
  already requires every handler to exist as a named stereotype with a sibling test.
  The same discipline that guarantees a handler's test exists can carry the expectation
  that the handler is declared with `Effect.fn`. The structural argument that _only_ the
  bus could guarantee coverage no longer holds as strongly.

This ADR records the decision to add a use-case-level span at every handler, composed
_inside_ the retained bus/endpoint boundary spans — and, separately, to move OTLP export
off the `@effect/opentelemetry` companion package onto Effect v4's first-party exporter.

## Decision

### Span discipline — add a use-case span, keep the boundary spans

The boundaries from ADR-0012 that produce a span are **retained unchanged**:

- HTTP (and CLI) endpoints span each operation. In v4 the endpoint adapter
  declares that boundary span the same way handlers do — `Effect.fn("<GroupLive.op>")`
  wrapping the generator body — rather than a trailing `Effect.withSpan(...)`. This
  is expression, not granularity: it is the _same_ per-operation boundary span
  ADR-0012 mandated, now written in the idiom v4 makes canonical (and that
  `@effect/language-service`'s `effectFnOpportunity` diagnostic steers toward). It
  does not add a span below the endpoint boundary.
- The command bus spans every dispatch: `command:<CommandTag>`.
- The query bus spans every dispatch: `query:<QueryTag>`.
- The domain event bus spans every event: `domainEvent:<EventTag>`.
- Repository methods span each method: `<Repository>.<method>`.

**Added:** every use-case handler — command handlers, query handlers, and event
handlers — is declared with `Effect.fn("<handlerName>")`, which names a span for the
handler body itself. That span nests _inside_ the bus/endpoint boundary span and _above_
the repository-method spans, so a trace now reads:

```
command:CompleteTodoCommand      (bus boundary)
└─ completeTodo                  (use case — new)
   └─ TodosRepository.updateOne  (repository)
      └─ <SQL>
```

The use-case span carries the function identity and source location, so a span in the
collector points back at the code that produced it — information the bus tag (a data
label derived from the command's `_tag`) does not carry. When a handler does several
things — mutate an aggregate, then dispatch domain events — those become children of the
handler's own span rather than siblings under the bus tag, so the causal tree matches the
handler body.

**Granularity rule.** Instrument at use-case granularity and no finer. A handler's span
plus the retained repository/bus/endpoint spans is the whole story; do not open spans for
private sub-steps. Where a use case delegates to a shared internal helper (for example,
the API-token mint core reused by both the mint use case and the device-grant poll), the
helper stays span-less so its `Effect.annotateCurrentSpan` calls land on whichever use
case invoked it. A shared helper acquiring its own span would be instrumentation below
use-case granularity — the speculative-generality smell this rule exists to prevent.

### Span attributes — unchanged

The sibling-extractor mechanism from ADR-0012 stands. Commands and queries carry a
`spanAttributes` extractor in their bus registry entry; domain events carry a per-module
`eventSpanAttributes` map merged at server wiring. The bus reads the extractor and merges
the audited, non-PHI/non-PII fields into the bus-level span. Values discovered mid-handler
(a freshly generated id) are still attached with `Effect.annotateCurrentSpan` — which now
annotates the handler's own use-case span rather than the bus span.

### Export — first-party OTLP tracer

ADR-0012 exported via `@effect/opentelemetry`'s `NodeSdk` layer configured with a
`BatchSpanProcessor` and an `OTLPTraceExporter` from the OpenTelemetry JS SDK. Effect v4
ships a first-party OTLP tracer in its observability module: a tracer layer that batches
ended spans and POSTs them, JSON-serialized, to the OTLP `/v1/traces` endpoint. The server
now uses it, closing its two requirements locally (a JSON serializer and a fetch-based
HTTP client). The collector URL stays environment-configured, and local development still
runs Jaeger via `docker-compose`.

This drops the `@effect/opentelemetry` and `@opentelemetry/*` dependency set from the
server, consistent with the v4 migration's goal of consolidating on the single `effect`
package. (The browser SDK in the frontend still uses the companion package; porting the
browser tracer to the first-party exporter is a tracked follow-up.)

### Two kinds of correlation — unchanged

The distinction ADR-0012 drew between OpenTelemetry trace propagation (automatic, links
spans within a fiber tree) and application-level correlation (request id, authenticated
user id, carried on domain events and structured logs) is unaffected by this change and
its follow-ups remain open.

## Consequences

- Traces gain a named, source-located span per use case without a manual instrumentation
  step: the span is a consequence of the `Effect.fn` declaration idiom, not an addition
  to it. Coverage is upheld by the same handler-stereotype discipline (ADR-0028) that
  already guarantees a sibling test.
- The causal tree matches the handler body: a handler's aggregate mutation and its event
  dispatch nest under the handler span, not flattened under the bus tag.
- One more span per request than the ADR-0012 posture. Span cardinality rises by roughly
  one per handled operation; sampling at the batch exporter remains the lever if it ever
  becomes a concern.
- The server no longer depends on `@effect/opentelemetry` or the OpenTelemetry JS SDK
  packages; tracing rides entirely on the `effect` package.
- The bus tag attributes (`command.tag`, `query.tag`, `event.tag`) are still emitted, so
  nothing that queried on them regresses.

## Alternatives considered

- **Keep bus-boundary-only spans (the ADR-0012 posture).** Rejected now that v4 makes the
  use-case span free at the point of declaration and the coverage argument has an
  independent guarantee. The flattened causal tree and the missing source location were
  real losses that no longer need to be accepted.
- **Instrument below use-case granularity** (spans on domain ops, shared helpers, private
  sub-steps). Rejected — that is speculative generality: it inflates trace cardinality and
  couples the trace shape to internal factoring that carries no operational meaning. The
  granularity rule above draws the line at the use case.
- **Move the span into the bus wrapper** (have the bus open a span named after the handler
  function rather than the tag). Rejected — the bus only knows the command tag, not the
  handler's identity or source location, which is exactly the information the use-case span
  adds. Declaring the span at the handler is what carries that information.
- **Defer the OTLP export swap.** Considered. The `@effect/opentelemetry` layer still
  resolves under the v4 beta, so the swap was not forced. Done now because it removes a
  companion-package dependency the rest of the migration is eliminating, and the first-
  party tracer is a drop-in for the server's traces-only export.

## Related

- ADR-0012 (superseded) — the prior bus-boundary-only span posture this replaces.
- ADR-0007 (synchronous dispatch) — what makes event-handler and subscriber spans appear
  under their publisher's trace.
- ADR-0028 (file-taxonomy enforcement) — the handler-stereotype discipline that upholds
  use-case span coverage.
