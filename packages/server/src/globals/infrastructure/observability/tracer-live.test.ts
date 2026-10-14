import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as OtlpExporter from "effect/observability/OtlpExporter";
import * as Option from "effect/Option";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";
import { TracerLive } from "@/globals/infrastructure/observability/tracer-live.ts";

const requiredEnv = {
  DATABASE_URL: "postgres://localhost/app",
  IDENTITY_ISSUER: "http://localhost:3002/api/auth",
  IDENTITY_CLIENT_ID: "client",
  IDENTITY_CLIENT_SECRET: "secret",
  SESSION_COOKIE_SECRET: "0".repeat(64),
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_ID_DEFAULT: "price_test",
};

const tracerWith = (env: Record<string, string>) =>
  TracerLive.pipe(
    Layer.provide(EnvVars.layer),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  );

const exportsSpans = Effect.map(Effect.serviceOption(OtlpExporter.Flusher), Option.isSome);

describe("TracerLive", () => {
  it.effect("exports nothing when no collector is configured", () =>
    Effect.gen(function* () {
      deepStrictEqual(yield* exportsSpans, false);
    }).pipe(Effect.provide(tracerWith(requiredEnv))),
  );

  it.effect("exports to the collector OTLP_URL names", () =>
    Effect.gen(function* () {
      deepStrictEqual(yield* exportsSpans, true);
    }).pipe(
      Effect.provide(tracerWith({ ...requiredEnv, OTLP_URL: "http://localhost:4318/v1/traces" })),
    ),
  );
});
