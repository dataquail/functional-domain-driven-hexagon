import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as nodemailer from "nodemailer";

import { EnvVars } from "@/common/env-vars.js";

import { MailDeliveryError } from "./mail-errors.js";
import { Mailer } from "./mailer.js";

// SMTP transport (`MAILER=smtp`). Local dev points it at the Mailpit
// container (`MAIL_SMTP_HOST=localhost`, port 1025); view delivered mail
// at http://localhost:8025. The same adapter works against any SMTP
// relay by changing the MAIL_SMTP_* env. The transporter is built once
// per layer and closed when the layer's scope ends.
export const SmtpMailerLive = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const user = env.MAIL_SMTP_USER;
    const pass = Redacted.value(env.MAIL_SMTP_PASSWORD);

    const transporter = yield* Effect.acquireRelease(
      Effect.sync(() =>
        nodemailer.createTransport({
          host: env.MAIL_SMTP_HOST,
          port: env.MAIL_SMTP_PORT,
          secure: env.MAIL_SMTP_SECURE,
          // Mailpit ignores SMTP AUTH; only pass credentials when set so we
          // don't send an empty-user AUTH that a stricter relay would reject.
          ...(user !== "" ? { auth: { user, pass } } : {}),
        }),
      ),
      (t) =>
        Effect.sync(() => {
          t.close();
        }),
    );

    return Mailer.of({
      send: (message) =>
        Effect.tryPromise({
          try: () =>
            transporter.sendMail({
              from: message.from ?? env.MAIL_FROM,
              to: message.to,
              subject: message.subject,
              html: message.html,
              text: message.text,
            }),
          catch: (cause) =>
            new MailDeliveryError({ message: `SMTP send failed: ${String(cause)}` }),
        }).pipe(Effect.asVoid),
    });
  }),
);
