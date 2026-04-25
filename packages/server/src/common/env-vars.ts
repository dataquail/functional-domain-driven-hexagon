import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

export class EnvVars extends Effect.Service<EnvVars>()("EnvVars", {
  accessors: true,
  effect: Effect.gen(function* () {
    return {
      // Server
      PORT: yield* Config.integer("PORT").pipe(Config.withDefault(3000)),
      ENV: yield* Config.literal("dev", "prod", "staging")("ENV").pipe(Config.withDefault("dev")),
      APP_URL: yield* Config.url("APP_URL").pipe(
        Config.map((url) => url.toString()),
        Config.withDefault("http://localhost:5173"),
      ),

      // Database
      DATABASE_URL: yield* Config.redacted("DATABASE_URL"),

      // Observability
      OTLP_URL: yield* Config.url("OTLP_URL").pipe(
        Config.withDefault("http://jaeger:4318/v1/traces"),
      ),
    } as const;
  }),
}) {}
