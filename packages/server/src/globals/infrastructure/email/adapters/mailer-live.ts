import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";

import { withDailyCap } from "../quota/daily-capped-mailer-live.js";
import { CloudflareEmailMailerLive } from "./cloudflare-email-mailer-live.js";
import { LogMailerLive } from "./log-mailer-live.js";
import { MailpitMailerFetchLive } from "./mailpit-mailer-live.js";

// The one place that names every transport; `MAILER` picks one per environment.
// Only the transport that costs money is capped.
export const MailerLive = Layer.unwrap(
  Effect.gen(function* () {
    const env = yield* EnvVars;

    switch (env.MAILER) {
      case "mailpit":
        return MailpitMailerFetchLive;
      case "cloudflare":
        return withDailyCap(CloudflareEmailMailerLive, env.MAIL_DAILY_CAP);
      case "log":
        return LogMailerLive;
    }
  }),
);
