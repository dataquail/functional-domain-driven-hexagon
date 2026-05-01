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
        Config.map((url) => url.origin),
        Config.withDefault("http://localhost:5173"),
      ),

      // Database
      DATABASE_URL: yield* Config.redacted("DATABASE_URL"),

      // Observability
      OTLP_URL: yield* Config.url("OTLP_URL").pipe(
        Config.withDefault("http://jaeger:4318/v1/traces"),
      ),

      // Zitadel / Auth
      ZITADEL_ISSUER: yield* Config.url("ZITADEL_ISSUER").pipe(
        Config.map((u) => u.toString().replace(/\/$/, "")),
      ),
      ZITADEL_CLIENT_ID: yield* Config.string("ZITADEL_CLIENT_ID"),
      ZITADEL_CLIENT_SECRET: yield* Config.redacted("ZITADEL_CLIENT_SECRET"),
      ZITADEL_REDIRECT_URI: yield* Config.string("ZITADEL_REDIRECT_URI").pipe(
        Config.withDefault("http://localhost:3000/auth/callback"),
      ),
      ZITADEL_POST_LOGOUT_REDIRECT_URI: yield* Config.string(
        "ZITADEL_POST_LOGOUT_REDIRECT_URI",
      ).pipe(Config.withDefault("http://localhost:5173/auth/login")),

      SESSION_COOKIE_NAME: yield* Config.string("SESSION_COOKIE_NAME").pipe(
        Config.withDefault("session"),
      ),
      SESSION_COOKIE_SECRET: yield* Config.redacted("SESSION_COOKIE_SECRET"),
      SESSION_TTL_SECONDS: yield* Config.integer("SESSION_TTL_SECONDS").pipe(
        Config.withDefault(3600),
      ),
      SESSION_ABSOLUTE_TTL_SECONDS: yield* Config.integer("SESSION_ABSOLUTE_TTL_SECONDS").pipe(
        Config.withDefault(43200),
      ),
    } as const;
  }),
}) {}
