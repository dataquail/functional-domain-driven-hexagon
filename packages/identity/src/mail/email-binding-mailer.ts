import * as Effect from "effect/Effect";

import { type IdentityMailer, MailDeliveryError, type MailSender } from "./identity-mailer.ts";

export type OutgoingEmail = {
  readonly from: { readonly email: string; readonly name: string };
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export type EmailSendingBinding = {
  readonly send: (message: OutgoingEmail) => Promise<{ readonly messageId: string }>;
};

export type EmailDelivery = (message: OutgoingEmail) => Effect.Effect<void, MailDeliveryError>;

export const deliveryThroughBinding =
  (binding: EmailSendingBinding): EmailDelivery =>
  (message) =>
    Effect.tryPromise({
      try: () => binding.send(message),
      catch: (cause) =>
        new MailDeliveryError({ message: `Email binding refused: ${String(cause)}` }),
    }).pipe(Effect.asVoid);

export const emailBindingMailer = (deliver: EmailDelivery, sender: MailSender): IdentityMailer => ({
  send: (email) =>
    deliver({
      from: { email: sender.address, name: sender.name },
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
});
