import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/common/env-vars.js";

import { LogMailerLive } from "./log-mailer-live.js";
import { type Mailer } from "./mailer.js";
import { SesMailerLive } from "./ses-mailer-live.js";
import { SmtpMailerLive } from "./smtp-mailer-live.js";

// Env-selected transport for the `Mailer` port. The composition root
// provides this single layer; the `MAILER` env var picks the backend at
// boot (`log` default, `smtp` for Mailpit/relay, `ses` for prod). This
// is the one place that names all three adapters — every consumer
// depends only on the `Mailer` Tag.
export const MailerLive: Layer.Layer<Mailer, never, EnvVars> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const env = yield* EnvVars;
    switch (env.MAILER) {
      case "smtp":
        return SmtpMailerLive;
      case "ses":
        return SesMailerLive;
      case "log":
        return LogMailerLive;
    }
  }),
);
