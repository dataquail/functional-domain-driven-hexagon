import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

export class EnvVars extends Effect.Service<EnvVars>()("EnvVars", {
  accessors: true,
  effect: Effect.gen(function* () {
    return {
      // Server
      PORT: yield* Config.integer("PORT").pipe(Config.withDefault(3001)),
      ENV: yield* Config.literal("dev", "prod", "staging")("ENV").pipe(Config.withDefault("dev")),
      APP_URL: yield* Config.url("APP_URL").pipe(
        Config.map((url) => url.origin),
        Config.withDefault("http://localhost:3000"),
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
        Config.withDefault("http://localhost:3000/api/auth/callback"),
      ),
      ZITADEL_POST_LOGOUT_REDIRECT_URI: yield* Config.string(
        "ZITADEL_POST_LOGOUT_REDIRECT_URI",
      ).pipe(Config.withDefault("http://localhost:3000/")),

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
      // Throttle for sliding-TTL writes: only `update` the session row when
      // the prior `lastUsedAt` is older than this many seconds. Prevents
      // every API call from issuing a write.
      SESSION_TOUCH_THRESHOLD_SECONDS: yield* Config.integer(
        "SESSION_TOUCH_THRESHOLD_SECONDS",
      ).pipe(Config.withDefault(60)),

      // Email / Notifications
      // Transport selection for the application `Mailer` port. `log` (default)
      // writes a structured log line — no real send. `smtp` targets the local
      // Mailpit sink (or any SMTP relay) for dev. `ses` uses AWS SES in prod.
      //
      // These MAIL_SMTP_* vars are deliberately namespaced apart from the bare
      // SMTP_* block, which configures *Zitadel's* notification provider inside
      // docker (where the host is the `mailpit` service name). The app server
      // runs on the host, so its default points at `localhost`. SES reads
      // region + credentials from the standard AWS chain (AWS_REGION, etc.).
      MAILER: yield* Config.literal("log", "smtp", "ses")("MAILER").pipe(Config.withDefault("log")),
      MAIL_FROM: yield* Config.string("MAIL_FROM").pipe(
        Config.withDefault("Effect Monorepo <noreply@localhost>"),
      ),
      MAIL_SMTP_HOST: yield* Config.string("MAIL_SMTP_HOST").pipe(Config.withDefault("localhost")),
      MAIL_SMTP_PORT: yield* Config.integer("MAIL_SMTP_PORT").pipe(Config.withDefault(1025)),
      MAIL_SMTP_SECURE: yield* Config.boolean("MAIL_SMTP_SECURE").pipe(Config.withDefault(false)),
      // Optional auth — Mailpit ignores credentials, so they default empty.
      MAIL_SMTP_USER: yield* Config.string("MAIL_SMTP_USER").pipe(Config.withDefault("")),
      MAIL_SMTP_PASSWORD: yield* Config.redacted("MAIL_SMTP_PASSWORD").pipe(
        Config.withDefault(Redacted.make("")),
      ),

      // Stripe / Billing
      STRIPE_SECRET_KEY: yield* Config.redacted("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: yield* Config.redacted("STRIPE_WEBHOOK_SECRET"),
      // Single default price id for the MVP. A real product would
      // resolve this from a plans catalog; we ship one tier.
      STRIPE_PRICE_ID_DEFAULT: yield* Config.string("STRIPE_PRICE_ID_DEFAULT"),
    } as const;
  }),
}) {}
