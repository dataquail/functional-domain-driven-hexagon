import * as Effect from "effect/Effect";

import { type IdentityMailer, MailDeliveryError, type MailSender } from "./identity-mailer.js";

export type EmailSendingBinding = {
  readonly send: (message: {
    readonly from: { readonly email: string; readonly name: string };
    readonly to: string;
    readonly subject: string;
    readonly text: string;
    readonly html: string;
  }) => Promise<unknown>;
};

export const emailBindingMailer = (
  binding: EmailSendingBinding,
  sender: MailSender,
): IdentityMailer => ({
  send: (email) =>
    Effect.tryPromise({
      try: () =>
        binding.send({
          from: { email: sender.address, name: sender.name },
          to: email.to,
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      catch: (cause) =>
        new MailDeliveryError({ message: `Email binding refused: ${String(cause)}` }),
    }).pipe(Effect.asVoid),
});
