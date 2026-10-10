import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

const make = Effect.gen(function* () {
  return {
    // Server
    PORT: yield* Config.Int("PORT").pipe(Config.withDefault(3001)),
    ENV: yield* Config.Literals(["dev", "prod", "staging"], "ENV").pipe(Config.withDefault("dev")),
    APP_URL: yield* Config.URL("APP_URL").pipe(
      Config.map((url) => url.origin),
      Config.withDefault("http://localhost:3000"),
    ),

    // Database
    DATABASE_URL: yield* Config.Redacted("DATABASE_URL"),

    // Observability
    OTLP_URL: yield* Config.URL("OTLP_URL").pipe(
      Config.withDefault("http://jaeger:4318/v1/traces"),
    ),

    // Zitadel / Auth
    ZITADEL_ISSUER: yield* Config.URL("ZITADEL_ISSUER").pipe(
      Config.map((u) => u.toString().replace(/\/$/, "")),
    ),
    ZITADEL_CLIENT_ID: yield* Config.String("ZITADEL_CLIENT_ID"),
    ZITADEL_CLIENT_SECRET: yield* Config.Redacted("ZITADEL_CLIENT_SECRET"),
    ZITADEL_REDIRECT_URI: yield* Config.String("ZITADEL_REDIRECT_URI").pipe(
      Config.withDefault("http://localhost:3000/api/auth/callback"),
    ),
    ZITADEL_POST_LOGOUT_REDIRECT_URI: yield* Config.String("ZITADEL_POST_LOGOUT_REDIRECT_URI").pipe(
      Config.withDefault("http://localhost:3000/"),
    ),

    SESSION_COOKIE_NAME: yield* Config.String("SESSION_COOKIE_NAME").pipe(
      Config.withDefault("session"),
    ),
    SESSION_COOKIE_SECRET: yield* Config.Redacted("SESSION_COOKIE_SECRET"),
    SESSION_TTL_SECONDS: yield* Config.Int("SESSION_TTL_SECONDS").pipe(Config.withDefault(3600)),
    SESSION_ABSOLUTE_TTL_SECONDS: yield* Config.Int("SESSION_ABSOLUTE_TTL_SECONDS").pipe(
      Config.withDefault(43200),
    ),
    // Throttle for sliding-TTL writes: only `update` the session row when
    // the prior `lastUsedAt` is older than this many seconds. Prevents
    // every API call from issuing a write.
    SESSION_TOUCH_THRESHOLD_SECONDS: yield* Config.Int("SESSION_TOUCH_THRESHOLD_SECONDS").pipe(
      Config.withDefault(60),
    ),

    // API tokens (ADR-0005). Default expiry applied when a mint request
    // omits `expiresInDays`. Touch threshold throttles the per-request
    // `last_used_at` write the bearer path issues, same as sessions.
    API_TOKEN_DEFAULT_TTL_DAYS: yield* Config.Int("API_TOKEN_DEFAULT_TTL_DAYS").pipe(
      Config.withDefault(90),
    ),
    API_TOKEN_TOUCH_THRESHOLD_SECONDS: yield* Config.Int("API_TOKEN_TOUCH_THRESHOLD_SECONDS").pipe(
      Config.withDefault(60),
    ),

    // Device authorization flow (ADR-0005). Grant TTL (how long the user
    // has to approve) and the poll interval the CLI is told to wait.
    DEVICE_CODE_TTL_SECONDS: yield* Config.Int("DEVICE_CODE_TTL_SECONDS").pipe(
      Config.withDefault(600),
    ),
    DEVICE_POLL_INTERVAL_SECONDS: yield* Config.Int("DEVICE_POLL_INTERVAL_SECONDS").pipe(
      Config.withDefault(5),
    ),

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
    MAILER: yield* Config.Literals(["log", "smtp", "ses"], "MAILER").pipe(
      Config.withDefault("log"),
    ),
    MAIL_FROM: yield* Config.String("MAIL_FROM").pipe(
      Config.withDefault("Effect Monorepo <noreply@localhost>"),
    ),
    MAIL_SMTP_HOST: yield* Config.String("MAIL_SMTP_HOST").pipe(Config.withDefault("localhost")),
    MAIL_SMTP_PORT: yield* Config.Int("MAIL_SMTP_PORT").pipe(Config.withDefault(1025)),
    MAIL_SMTP_SECURE: yield* Config.Boolean("MAIL_SMTP_SECURE").pipe(Config.withDefault(false)),
    // Optional auth — Mailpit ignores credentials, so they default empty.
    MAIL_SMTP_USER: yield* Config.String("MAIL_SMTP_USER").pipe(Config.withDefault("")),
    MAIL_SMTP_PASSWORD: yield* Config.Redacted("MAIL_SMTP_PASSWORD").pipe(
      Config.withDefault(Redacted.make("")),
    ),

    // Stripe / Billing
    STRIPE_SECRET_KEY: yield* Config.Redacted("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: yield* Config.Redacted("STRIPE_WEBHOOK_SECRET"),
    // Single default price id for the MVP. A real product would
    // resolve this from a plans catalog; we ship one tier.
    STRIPE_PRICE_ID_DEFAULT: yield* Config.String("STRIPE_PRICE_ID_DEFAULT"),
  } as const;
});

export class EnvVars extends Context.Service<EnvVars, Effect.Success<typeof make>>()("EnvVars") {
  public static readonly layer = Layer.effect(EnvVars, make);
}
