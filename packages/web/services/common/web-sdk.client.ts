"use client";

// Browser-side OpenTelemetry. Mirrors `instrumentation.ts` (Node side)
// so the browser-originated span becomes the parent of the Next render
// span, and Jaeger shows browser → Next → Effect as a single
// three-tier trace.
//
// Wired into `runtime.client.tsx`'s layer composition so any Effect
// run on the client runtime (queries, mutations, view-models) emits
// spans against this SDK. The browser propagates W3C `traceparent` on
// outbound `/api/*` fetches; Next's rewrite forwards the header to the
// Effect server, which inherits the trace ID.
//
// Endpoint defaults to the dev Jaeger collector. Override at build
// time via `NEXT_PUBLIC_OTLP_URL` (Next inlines `NEXT_PUBLIC_*` into
// the client bundle). CORS for `http://localhost:*` is already
// allowed in `infra/jaeger/config.yaml`.

import * as WebSdk from "@effect/opentelemetry/WebSdk";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const OTLP_URL = process.env.NEXT_PUBLIC_OTLP_URL ?? "http://localhost:4318/v1/traces";

export const WebSdkLive = WebSdk.layer(() => ({
  resource: {
    serviceName: "effect-monorepo-web-browser",
  },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter({ url: OTLP_URL })),
}));
