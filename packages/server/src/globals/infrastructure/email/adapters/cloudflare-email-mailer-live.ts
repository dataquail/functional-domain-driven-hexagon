import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { EnvVars } from "@/globals/infrastructure/config/env-vars";
import { EmailBinding } from "@/globals/infrastructure/runtime/email-binding";

import { MailDeliveryError } from "../ports/mail-errors";
import { Mailer } from "../ports/mailer";

// Cloudflare Email Service through the Worker's `send_email` binding.
export const CloudflareEmailMailerLive: Layer.Layer<Mailer, never, EnvVars> = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const binding = yield* Effect.service(EmailBinding);

    if (Option.isNone(binding.send)) {
      return yield* Effect.die(new Error("MAILER=cloudflare needs the Worker's EMAIL binding"));
    }

    const send = binding.send.value;
    const from = { email: env.MAIL_FROM_ADDRESS, name: env.MAIL_FROM_NAME };

    return Mailer.of({
      send: (message) =>
        send({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }).pipe(
          Effect.mapError(
            (cause) =>
              new MailDeliveryError({ message: `Email binding refused: ${String(cause)}` }),
          ),
          Effect.withSpan("CloudflareEmailMailer.send"),
        ),
    });
  }),
);
