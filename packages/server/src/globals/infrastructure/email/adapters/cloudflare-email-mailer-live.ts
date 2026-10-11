import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";
import { EmailBinding } from "@/globals/infrastructure/runtime/email-binding.js";

import { MailDeliveryError } from "../ports/mail-errors.js";
import { Mailer } from "../ports/mailer.js";

// Cloudflare Email Service through the Worker's `send_email` binding.
export const CloudflareEmailMailerLive: Layer.Layer<Mailer, never, EnvVars> = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const { send } = yield* Effect.service(EmailBinding);
    if (send === undefined) {
      return yield* Effect.die(new Error("MAILER=cloudflare needs the Worker's EMAIL binding"));
    }
    const from = { email: env.MAIL_FROM_ADDRESS, name: env.MAIL_FROM_NAME };
    return Mailer.of({
      send: (message) =>
        Effect.tryPromise({
          try: () =>
            send({
              from,
              to: message.to,
              subject: message.subject,
              text: message.text,
              html: message.html,
            }),
          catch: (cause) =>
            new MailDeliveryError({ message: `Email binding refused: ${String(cause)}` }),
        }).pipe(Effect.asVoid, Effect.withSpan("CloudflareEmailMailer.send")),
    });
  }),
);
