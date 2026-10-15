import { AwsV4Signer } from "aws4fetch";
import * as Effect from "effect/Effect";
import type * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Schema from "effect/Schema";

import { type EmailDelivery, type OutgoingEmail } from "./email-binding-mailer";
import { MailDeliveryError } from "./identity-mailer";

export type SesCredentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
  readonly region: string;
};

const utf8 = (data: string) => ({ Data: data, Charset: "UTF-8" });

const SesSendEmail = Schema.Struct({
  FromEmailAddress: Schema.String,
  Destination: Schema.Struct({ ToAddresses: Schema.Array(Schema.String) }),
  Content: Schema.Struct({
    Simple: Schema.Struct({
      Subject: Schema.Struct({ Data: Schema.String, Charset: Schema.String }),
      Body: Schema.Struct({
        Text: Schema.Struct({ Data: Schema.String, Charset: Schema.String }),
        Html: Schema.Struct({ Data: Schema.String, Charset: Schema.String }),
      }),
    }),
  }),
});

const encodeSendEmail = Schema.encodeSync(Schema.fromJsonString(SesSendEmail));

export const toSesSendEmail = (message: OutgoingEmail): typeof SesSendEmail.Type => ({
  FromEmailAddress: `"${message.from.name.replaceAll('"', "")}" <${message.from.email}>`,
  Destination: { ToAddresses: [message.to] },
  Content: {
    Simple: {
      Subject: utf8(message.subject),
      Body: { Text: utf8(message.text), Html: utf8(message.html) },
    },
  },
});

const signedHeaders = (credentials: SesCredentials, url: string, body: string) =>
  Effect.promise(() =>
    new AwsV4Signer({
      method: "POST",
      url,
      headers: { "content-type": "application/json" },
      body,
      service: "ses",
      ...credentials,
    }).sign(),
  ).pipe(Effect.map((signed) => Object.fromEntries(signed.headers.entries())));

// SES v2 SendEmail, signed with the Lambda execution role's credentials.
export const deliveryThroughSes =
  (credentials: SesCredentials, client: HttpClient.HttpClient): EmailDelivery =>
  (message) =>
    Effect.gen(function* () {
      const url = `https://email.${credentials.region}.amazonaws.com/v2/email/outbound-emails`;
      const body = encodeSendEmail(toSesSendEmail(message));

      const response = yield* client
        .execute(
          HttpClientRequest.post(url).pipe(
            HttpClientRequest.setHeaders(yield* signedHeaders(credentials, url, body)),
            HttpClientRequest.bodyText(body, "application/json"),
          ),
        )
        .pipe(
          Effect.mapError(
            (cause) => new MailDeliveryError({ message: `SES unreachable: ${cause.message}` }),
          ),
        );

      if (response.status >= 300) {
        const text = yield* Effect.orDie(response.text);

        return yield* new MailDeliveryError({
          message: `SES refused the message: ${response.status} ${text}`,
        });
      }
    });
