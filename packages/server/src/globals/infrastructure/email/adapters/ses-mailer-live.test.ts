import { deepStrictEqual, ok } from "node:assert";

import { describe, layer } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import type * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import { EnvVars } from "@/globals/infrastructure/config/env-vars";
import { SesMailerLive } from "@/globals/infrastructure/email/adapters/ses-mailer-live";
import { MailDeliveryError } from "@/globals/infrastructure/email/ports/mail-errors";
import { Mailer } from "@/globals/infrastructure/email/ports/mailer";

const env = {
  DATABASE_URL: "postgres://localhost/app",
  IDENTITY_ISSUER: "http://localhost:3002/api/auth",
  IDENTITY_CLIENT_ID: "app",
  IDENTITY_CLIENT_SECRET: "secret",
  SESSION_COOKIE_SECRET: "0".repeat(64),
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_ID_DEFAULT: "price_test",
  MAIL_FROM_ADDRESS: "noreply@example.com",
  MAIL_FROM_NAME: "Example",
  AWS_ACCESS_KEY_ID: "AKIDEXAMPLE",
  AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  AWS_SESSION_TOKEN: "session-token",
  AWS_REGION: "us-east-2",
};

type Sent = { url: string; headers: Readonly<Record<string, string>>; body: Schema.Json };

const decodeJsonBody = Schema.decodeSync(Schema.fromJsonString(Schema.Json));

const bodyBytes = (body: HttpBody.HttpBody): Uint8Array => {
  if (Predicate.isTagged(body, "Uint8Array")) return body.body;

  return new Uint8Array();
};

const sesAnswering = (status: number, sent: Array<Sent>) =>
  SesMailerLive.pipe(
    Layer.provide(EnvVars.layer),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) => {
          sent.push({
            url: request.url,
            headers: request.headers,
            body: decodeJsonBody(new TextDecoder().decode(bodyBytes(request.body))),
          });

          return Effect.succeed(
            HttpClientResponse.fromWeb(request, new Response("{}", { status })),
          );
        }),
      ),
    ),
  );

const message = { to: "alice@example.com", subject: "Hi", text: "plain", html: "<p>html</p>" };

describe("SesMailerLive", () => {
  const sent: Array<Sent> = [];

  layer(sesAnswering(200, sent))((it) => {
    it.effect("sends the message through SES v2 from the configured sender", () =>
      Effect.gen(function* () {
        const mailer = yield* Mailer;
        yield* mailer.send(message);

        deepStrictEqual(
          sent.map(({ body, url }) => ({ url, body })),
          [
            {
              url: "https://email.us-east-2.amazonaws.com/v2/email/outbound-emails",
              body: {
                FromEmailAddress: '"Example" <noreply@example.com>',
                Destination: { ToAddresses: ["alice@example.com"] },
                Content: {
                  Simple: {
                    Subject: { Data: "Hi", Charset: "UTF-8" },
                    Body: {
                      Text: { Data: "plain", Charset: "UTF-8" },
                      Html: { Data: "<p>html</p>", Charset: "UTF-8" },
                    },
                  },
                },
              },
            },
          ],
        );
      }),
    );

    it.effect("signs the request with the execution role's credentials", () =>
      Effect.gen(function* () {
        const mailer = yield* Mailer;
        yield* mailer.send(message);
        const headers = sent.at(-1)?.headers ?? {};

        const authorization = headers.authorization ?? "";

        ok(authorization.startsWith("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/"));
        ok(authorization.includes("/us-east-2/ses/aws4_request"));
        deepStrictEqual(headers["x-amz-security-token"], "session-token");
      }),
    );
  });

  layer(sesAnswering(400, []))((it) => {
    it.effect("fails with MailDeliveryError when SES refuses the message", () =>
      Effect.gen(function* () {
        const mailer = yield* Mailer;
        const error = yield* Effect.flip(mailer.send(message));

        assertInstanceOf(error, MailDeliveryError);
      }),
    );
  });
});
