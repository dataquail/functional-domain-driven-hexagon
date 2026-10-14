import { deepStrictEqual } from "node:assert";

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

import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";
import { MailpitMailerLive } from "@/globals/infrastructure/email/adapters/mailpit-mailer-live.ts";
import { MailDeliveryError } from "@/globals/infrastructure/email/ports/mail-errors.ts";
import { Mailer } from "@/globals/infrastructure/email/ports/mailer.ts";

const env = {
  DATABASE_URL: "postgres://localhost/app",
  IDENTITY_ISSUER: "http://localhost:3002/api/auth",
  IDENTITY_CLIENT_ID: "app",
  IDENTITY_CLIENT_SECRET: "secret",
  SESSION_COOKIE_SECRET: "0".repeat(64),
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_ID_DEFAULT: "price_test",
  MAILPIT_URL: "http://mailpit.test:8025",
  MAIL_FROM_ADDRESS: "noreply@example.com",
  MAIL_FROM_NAME: "Example",
};

type Sent = { url: string; body: Schema.Json };

const decodeJsonBody = Schema.decodeSync(Schema.fromJsonString(Schema.Json));

const bodyBytes = (body: HttpBody.HttpBody): Uint8Array => {
  if (Predicate.isTagged(body, "Uint8Array")) return body.body;

  return new Uint8Array();
};

const mailpitAnswering = (status: number, sent: Array<Sent>) =>
  MailpitMailerLive.pipe(
    Layer.provide(EnvVars.layer),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) => {
          sent.push({
            url: request.url,
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

describe("MailpitMailerLive", () => {
  const sent: Array<Sent> = [];

  layer(mailpitAnswering(200, sent))((it) => {
    it.effect("posts the message to Mailpit's send API from the configured sender", () =>
      Effect.gen(function* () {
        const mailer = yield* Mailer;
        yield* mailer.send(message);

        deepStrictEqual(sent, [
          {
            url: "http://mailpit.test:8025/api/v1/send",
            body: {
              From: { Email: "noreply@example.com", Name: "Example" },
              To: [{ Email: "alice@example.com" }],
              Subject: "Hi",
              Text: "plain",
              HTML: "<p>html</p>",
            },
          },
        ]);
      }),
    );
  });

  layer(mailpitAnswering(400, []))((it) => {
    it.effect("fails with MailDeliveryError when Mailpit refuses the message", () =>
      Effect.gen(function* () {
        const mailer = yield* Mailer;
        const error = yield* Effect.flip(mailer.send(message));

        assertInstanceOf(error, MailDeliveryError);
      }),
    );
  });
});
