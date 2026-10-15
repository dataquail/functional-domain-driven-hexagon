import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import * as OtlpTracer from "effect/observability/OtlpTracer";
import * as Option from "effect/Option";

import { EnvVars } from "@/globals/infrastructure/config/env-vars";

// Spans export only where OTLP_URL names a collector; closing the layer's scope
// sends whatever is still batched.
export const TracerLive = Layer.unwrap(
  Effect.map(EnvVars, (env) =>
    Option.match(env.OTLP_URL, {
      onNone: () => Layer.empty,
      onSome: (url) =>
        OtlpTracer.layer({
          url: url.toString(),
          resource: { serviceName: "effect-monorepo-server" },
        }).pipe(Layer.provide([OtlpSerialization.layerJson, FetchHttpClient.layer])),
    }),
  ),
);
