import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars";

import { withDailyCap } from "../quota/daily-capped-mailer-live";
import { CloudflareEmailMailerLive } from "./cloudflare-email-mailer-live";
import { LogMailerLive } from "./log-mailer-live";
import { MailpitMailerFetchLive } from "./mailpit-mailer-live";
import { SesMailerFetchLive } from "./ses-mailer-live";

// The one place that names every transport; `MAILER` picks one per environment.
// Only the transports that cost money are capped.
export const MailerLive = Layer.unwrap(
  Effect.gen(function* () {
    const env = yield* EnvVars;

    switch (env.MAILER) {
      case "mailpit":
        return MailpitMailerFetchLive;
      case "cloudflare":
        return withDailyCap(CloudflareEmailMailerLive, env.MAIL_DAILY_CAP);
      case "ses":
        return withDailyCap(SesMailerFetchLive, env.MAIL_DAILY_CAP);
      case "log":
        return LogMailerLive;
    }
  }),
);
