import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";
import { MailpitMailerLive } from "@/globals/infrastructure/email/adapters/mailpit-mailer-live.js";
import { Mailer } from "@/globals/infrastructure/email/ports/mailer.js";

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

type Sent = { url: string; body: unknown };

const mailpitAnswering = (status: number, sent: Array<Sent>) =>
  MailpitMailerLive.pipe(
    Layer.provide(EnvVars.layer),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) => {
          const body = request.body._tag === "Uint8Array" ? request.body.body : new Uint8Array();
          sent.push({ url: request.url, body: JSON.parse(new TextDecoder().decode(body)) });
          return Effect.succeed(
            HttpClientResponse.fromWeb(request, new Response("{}", { status })),
          );
        }),
      ),
    ),
  );

const message = { to: "alice@example.com", subject: "Hi", text: "plain", html: "<p>html</p>" };

describe("MailpitMailerLive", () => {
  it.effect("posts the message to Mailpit's send API from the configured sender", () =>
    Effect.gen(function* () {
      const sent: Array<Sent> = [];
      yield* Effect.flatMap(Effect.service(Mailer), (mailer) => mailer.send(message)).pipe(
        Effect.provide(mailpitAnswering(200, sent)),
      );

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

  it.effect("fails with MailDeliveryError when Mailpit refuses the message", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.flatMap(Effect.service(Mailer), (mailer) =>
        mailer.send(message),
      ).pipe(Effect.provide(mailpitAnswering(400, [])), Effect.exit);

      deepStrictEqual(
        Exit.isFailure(exit) && exit.cause.reasons[0]?._tag === "Fail"
          ? exit.cause.reasons[0].error._tag
          : "succeeded",
        "MailDeliveryError",
      );
    }),
  );
});
