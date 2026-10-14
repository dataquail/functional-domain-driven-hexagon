import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const make = Effect.gen(function* () {
  return {
    // Server
    APP_URL: yield* Config.URL("APP_URL").pipe(
      Config.map((url) => url.origin),
      Config.withDefault("http://localhost:3000"),
    ),

    // Database
    DATABASE_URL: yield* Config.Redacted("DATABASE_URL"),

    // Observability
    OTLP_URL: yield* Config.option(Config.URL("OTLP_URL")),

    // Identity provider (the identity Worker, an OIDC issuer) / Auth
    IDENTITY_ISSUER: yield* Config.URL("IDENTITY_ISSUER").pipe(
      Config.map((u) => u.toString().replace(/\/$/, "")),
    ),
    IDENTITY_CLIENT_ID: yield* Config.String("IDENTITY_CLIENT_ID"),
    IDENTITY_CLIENT_SECRET: yield* Config.Redacted("IDENTITY_CLIENT_SECRET"),
    IDENTITY_REDIRECT_URI: yield* Config.String("IDENTITY_REDIRECT_URI").pipe(
      Config.withDefault("http://localhost:3000/api/auth/callback"),
    ),
    IDENTITY_POST_LOGOUT_REDIRECT_URI: yield* Config.String(
      "IDENTITY_POST_LOGOUT_REDIRECT_URI",
    ).pipe(Config.withDefault("http://localhost:3000/")),

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
    // `log` (default) writes a structured log line and sends nothing; `mailpit`
    // posts to Mailpit's HTTP API; `cloudflare` sends through the Worker's
    // `send_email` binding.
    MAILER: yield* Config.Literals(["log", "mailpit", "cloudflare"], "MAILER").pipe(
      Config.withDefault("log"),
    ),
    MAIL_FROM_ADDRESS: yield* Config.String("MAIL_FROM_ADDRESS").pipe(
      Config.withDefault("noreply@localhost"),
    ),
    MAIL_FROM_NAME: yield* Config.String("MAIL_FROM_NAME").pipe(
      Config.withDefault("Effect Monorepo"),
    ),
    MAIL_DAILY_CAP: yield* Config.Int("MAIL_DAILY_CAP").pipe(Config.withDefault(200)),
    MAILPIT_URL: yield* Config.String("MAILPIT_URL").pipe(
      Config.withDefault("http://localhost:8025"),
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
