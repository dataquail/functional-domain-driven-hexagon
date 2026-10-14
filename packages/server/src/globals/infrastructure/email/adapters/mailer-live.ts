import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";

import { type Mailer } from "../ports/mailer.js";
import { CloudflareEmailMailerLive } from "./cloudflare-email-mailer-live.js";
import { LogMailerLive } from "./log-mailer-live.js";
import { MailpitMailerFetchLive } from "./mailpit-mailer-live.js";

// The one place that names every transport; `MAILER` picks one per environment.
export const MailerLive: Layer.Layer<Mailer, never, EnvVars> = Layer.unwrap(
  Effect.gen(function* () {
    const env = yield* EnvVars;
    switch (env.MAILER) {
      case "mailpit":
        return MailpitMailerFetchLive;
      case "cloudflare":
        return CloudflareEmailMailerLive;
      case "log":
        return LogMailerLive;
    }
  }),
);
