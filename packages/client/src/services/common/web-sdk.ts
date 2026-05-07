import { envVars } from "@/lib/env-vars";
import * as WebSdk from "@effect/opentelemetry/WebSdk";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export const WebSdkLive = WebSdk.layer(() => ({
  resource: {
    serviceName: "effect-monorepo-client",
  },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: envVars.OTLP_URL.toString(),
    }),
  ),
}));
