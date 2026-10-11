import * as Effect from "effect/Effect";

import {
  type IdentityEmail,
  type IdentityMailer,
  MailDeliveryError,
  type MailSender,
} from "./identity-mailer.js";

export type MailpitMailerSettings = {
  readonly url: string;
  readonly sender: MailSender;
  readonly fetch?: typeof globalThis.fetch;
};

const toMailpitMessage = (sender: MailSender, email: IdentityEmail) => ({
  From: { Email: sender.address, Name: sender.name },
  To: [{ Email: email.to }],
  Subject: email.subject,
  Text: email.text,
  HTML: email.html,
});

export const mailpitMailer = ({
  fetch = globalThis.fetch,
  sender,
  url,
}: MailpitMailerSettings): IdentityMailer => ({
  send: Effect.fn("mailpitMailer.send")(function* (email) {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(new URL("/api/v1/send", url), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(toMailpitMessage(sender, email)),
        }),
      catch: (cause) => new MailDeliveryError({ message: `Mailpit unreachable: ${String(cause)}` }),
    });
    if (!response.ok) {
      const body = yield* Effect.promise(() => response.text());
      return yield* new MailDeliveryError({
        message: `Mailpit refused the message: ${response.status} ${body}`,
      });
    }
  }),
});
