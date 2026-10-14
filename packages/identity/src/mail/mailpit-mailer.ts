import * as Effect from "effect/Effect";
import type * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Schema from "effect/Schema";

import {
  type IdentityEmail,
  type IdentityMailer,
  MailDeliveryError,
  type MailSender,
} from "./identity-mailer.ts";

export type MailpitMailerSettings = {
  readonly url: string;
  readonly sender: MailSender;
  readonly client: HttpClient.HttpClient;
};

export const MailpitMessage = Schema.Struct({
  From: Schema.Struct({ Email: Schema.String, Name: Schema.String }),
  To: Schema.Array(Schema.Struct({ Email: Schema.String })),
  Subject: Schema.String,
  Text: Schema.String,
  HTML: Schema.String,
});

const encodeMailpitMessage = Schema.encodeSync(Schema.fromJsonString(MailpitMessage));

const toMailpitMessage = (
  sender: MailSender,
  email: IdentityEmail,
): typeof MailpitMessage.Type => ({
  From: { Email: sender.address, Name: sender.name },
  To: [{ Email: email.to }],
  Subject: email.subject,
  Text: email.text,
  HTML: email.html,
});

export const mailpitMailer = ({ client, sender, url }: MailpitMailerSettings): IdentityMailer => ({
  send: Effect.fn("mailpitMailer.send")(function* (email) {
    const response = yield* client
      .execute(
        HttpClientRequest.post(new URL("/api/v1/send", url)).pipe(
          HttpClientRequest.bodyText(
            encodeMailpitMessage(toMailpitMessage(sender, email)),
            "application/json",
          ),
        ),
      )
      .pipe(
        Effect.mapError(
          (cause) => new MailDeliveryError({ message: `Mailpit unreachable: ${cause.message}` }),
        ),
      );

    if (response.status >= 300) {
      const body = yield* Effect.orDie(response.text);

      return yield* new MailDeliveryError({
        message: `Mailpit refused the message: ${response.status} ${body}`,
      });
    }
  }),
});
