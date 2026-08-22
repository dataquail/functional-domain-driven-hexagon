"use client";

// Browser-side tracing for everything the atom graph runs.
//
// `addGlobalLayer` reaches every runtime the default factory builds, so a query
// atom, a mutation and a ViewModel action all emit against the same tracer
// without any of them naming it. The registration happens at module load and
// the global layer is read when a runtime is first built, so importing this
// from the provider is early enough.
//
// The browser propagates `traceparent` on outbound `/api/*` fetches — Effect's
// `HttpClient` propagation, left ENABLED on the client (unlike the Next server
// runtime, where `@vercel/otel` owns propagation and Effect's is disabled).
// Next's `/api/*` rewrite forwards the header and `@vercel/otel` continues the
// trace to the BFF, so Jaeger stitches browser → Next → BFF into one trace.
//
// Endpoint defaults to the dev Jaeger collector; override at build time via
// `NEXT_PUBLIC_OTLP_URL` (Next inlines `NEXT_PUBLIC_*` into the client bundle).
// CORS for `http://localhost:*` is allowed in `infra/jaeger/config.yaml`.

import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";
import * as Atom from "effect/unstable/reactivity/Atom";

const OTLP_URL = process.env.NEXT_PUBLIC_OTLP_URL ?? "http://localhost:4318/v1/traces";

export const BrowserTracerLive = OtlpTracer.layer({
  url: OTLP_URL,
  resource: {
    serviceName: "effect-monorepo-web-browser",
  },
}).pipe(Layer.provide([OtlpSerialization.layerJson, FetchHttpClient.layer]));

Atom.runtime.addGlobalLayer(BrowserTracerLive);
