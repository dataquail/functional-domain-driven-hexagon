import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/common/env-vars.js";

import { MailDeliveryError } from "./mail-errors.js";
import { Mailer } from "./mailer.js";

// AWS SES transport (`MAILER=ses`), for prod. Region + credentials come
// from the standard AWS provider chain (AWS_REGION, instance/role creds,
// or AWS_ACCESS_KEY_ID/SECRET). The `from` address (default `MAIL_FROM`)
// must be a verified SES identity.
//
// SCAFFOLD: this adapter is wired and type-checked, but is not exercised
// by the test suite — there's no SES sandbox in CI. Verify against a real
// SES identity (or LocalStack) before relying on it in an environment.
export const SesMailerLive = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const client = yield* Effect.acquireRelease(
      Effect.sync(() => new SESv2Client({})),
      (c) =>
        Effect.sync(() => {
          c.destroy();
        }),
    );

    return Mailer.of({
      send: (message) =>
        Effect.tryPromise({
          try: () =>
            client.send(
              new SendEmailCommand({
                FromEmailAddress: message.from ?? env.MAIL_FROM,
                Destination: { ToAddresses: [message.to] },
                Content: {
                  Simple: {
                    Subject: { Data: message.subject },
                    Body: {
                      Html: { Data: message.html },
                      Text: { Data: message.text },
                    },
                  },
                },
              }),
            ),
          catch: (cause) => new MailDeliveryError({ message: `SES send failed: ${String(cause)}` }),
        }).pipe(Effect.asVoid),
    });
  }),
);
