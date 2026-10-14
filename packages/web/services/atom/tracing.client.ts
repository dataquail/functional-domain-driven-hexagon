// Browser-side tracing for everything the atom graph runs.
//
// `addGlobalLayer` reaches every runtime the default factory builds, so a query
// atom, a mutation and a ViewModel action all emit against the same tracer
// without any of them naming it. The client hook imports this before the app
// hydrates, which is before any runtime is built.
//
// The browser propagates `traceparent` on outbound `/api/*` fetches; the proxy
// forwards the header and the server Worker continues the trace.
//
// Endpoint defaults to the dev Jaeger collector; override at build time via
// `VITE_OTLP_URL`.

import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import * as OtlpTracer from "effect/observability/OtlpTracer";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";

const OTLP_URL = Schema.decodeUnknownOption(Schema.String)(import.meta.env.VITE_OTLP_URL).pipe(
  Option.getOrElse(() => "http://localhost:4318/v1/traces"),
);

export const BrowserTracerLive = OtlpTracer.layer({
  url: OTLP_URL,
  resource: {
    serviceName: "effect-monorepo-web-browser",
  },
}).pipe(Layer.provide([OtlpSerialization.layerJson, FetchHttpClient.layer]));

Atom.runtime.addGlobalLayer(BrowserTracerLive);
