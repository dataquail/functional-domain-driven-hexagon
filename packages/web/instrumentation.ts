// Phase 5 of the Next.js migration. Initializes Node OTEL on Next boot
// and exports traces to the same OTLP collector the Effect server
// already uses (`OTLP_URL` env var, ADR-0012). The browser SDK in the
// existing SPA points at the same collector, so a request that
// originates in the browser → Next → Effect server arrives at Jaeger
// as a single trace with three spans (browser navigation, Next render
// + prefetch, Effect handler).
//
// Next.js loads this file once per process at startup. The export
// shape (`register` function) is the canonical convention; see
// node_modules/next/dist/docs/ for current Next 16 details.
//
// `@vercel/otel` bundles:
//   - W3C trace context propagation (so the `traceparent` header is
//     emitted on outbound fetch and forwarded by the `/api/*` rewrite
//     to the Effect server, which inherits the trace ID).
//   - Auto-instrumentation for the Node fetch/undici client and the
//     Next.js internal HTTP server.
//   - OTLP HTTP/JSON exporter, matching the Effect server's
//     `@opentelemetry/exporter-trace-otlp-http` choice.
//
// Despite the package name, `@vercel/otel` works on any Node host
// (including the docker-compose dev loop and the eventual prod
// deploy). It's the path Next's own docs recommend.

import { OTLPHttpJsonTraceExporter, registerOTel } from "@vercel/otel";

const OTLP_URL = process.env.OTLP_URL ?? "http://localhost:4318/v1/traces";

export const register = (): void => {
  registerOTel({
    serviceName: "effect-monorepo-web",
    traceExporter: new OTLPHttpJsonTraceExporter({ url: OTLP_URL }),
  });
};
