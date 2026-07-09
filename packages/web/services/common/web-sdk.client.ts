"use client";

// Browser-side tracing. First-party OTLP tracer from
// `effect/unstable/observability` (mirrors server.ts's `TracerLive`),
// replacing the `@effect/opentelemetry` WebSdk — the last consumer of that
// companion package, so it drops out of the monorepo entirely (ADR-0029).
//
// Provided into `runtime.client.tsx`'s layer composition, so any Effect run on
// the client runtime (queries, mutations, view-models) emits spans against it.
// The browser propagates `traceparent` on outbound `/api/*` fetches — Effect's
// `HttpClient` propagation, left ENABLED on the client runtime (unlike the
// Next server runtime, where `@vercel/otel` owns propagation and Effect's is
// disabled). Next's `/api/*` rewrite forwards the header and `@vercel/otel`
// continues the trace to the BFF, so Jaeger stitches browser → Next → BFF into
// one trace.
//
// `OtlpTracer.layer` closes its two requirements locally: JSON serialization
// (`OtlpSerialization.layerJson`) and an `HttpClient` (`FetchHttpClient.layer`
// — global `fetch`, available in the browser). Endpoint defaults to the dev
// Jaeger collector; override at build time via `NEXT_PUBLIC_OTLP_URL` (Next
// inlines `NEXT_PUBLIC_*` into the client bundle). CORS for `http://localhost:*`
// is allowed in `infra/jaeger/config.yaml`.

import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";

const OTLP_URL = process.env.NEXT_PUBLIC_OTLP_URL ?? "http://localhost:4318/v1/traces";

export const WebSdkLive = OtlpTracer.layer({
  url: OTLP_URL,
  resource: {
    serviceName: "effect-monorepo-web-browser",
  },
}).pipe(Layer.provide([OtlpSerialization.layerJson, FetchHttpClient.layer]));
