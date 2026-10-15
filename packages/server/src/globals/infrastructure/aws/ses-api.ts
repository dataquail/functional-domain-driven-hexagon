import * as Effect from "effect/Effect";

import { type AwsCredentials, awsPost, encodeJson } from "./aws-api";

export type SesEmail = {
  readonly from: { readonly email: string; readonly name: string };
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

const utf8 = (data: string) => ({ Data: data, Charset: "UTF-8" });

const displayAddress = ({ email, name }: SesEmail["from"]): string =>
  `"${name.replaceAll('"', "")}" <${email}>`;

// SES v2 SendEmail, a REST-JSON call.
export const sendEmail = Effect.fn("Ses.sendEmail")(function* (
  credentials: AwsCredentials,
  email: SesEmail,
) {
  yield* awsPost(credentials, {
    service: "ses",
    url: `https://email.${credentials.region}.amazonaws.com/v2/email/outbound-emails`,
    headers: { "content-type": "application/json" },
    body: encodeJson({
      FromEmailAddress: displayAddress(email.from),
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: utf8(email.subject),
          Body: { Text: utf8(email.text), Html: utf8(email.html) },
        },
      },
    }),
  });
});
