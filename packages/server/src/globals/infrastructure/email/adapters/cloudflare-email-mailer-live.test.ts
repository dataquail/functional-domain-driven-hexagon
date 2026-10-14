import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";
import { CloudflareEmailMailerLive } from "@/globals/infrastructure/email/adapters/cloudflare-email-mailer-live.js";
import { Mailer } from "@/globals/infrastructure/email/ports/mailer.js";
import {
  EmailBinding,
  type EmailBindingMessage,
} from "@/globals/infrastructure/runtime/email-binding.js";

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
};

const mailerOver = (binding: Layer.Layer<never>) =>
  CloudflareEmailMailerLive.pipe(
    Layer.provide(binding),
    Layer.provide(EnvVars.layer),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  );

const message = { to: "alice@example.com", subject: "Hi", text: "plain", html: "<p>html</p>" };

const sendThrough = (binding: Layer.Layer<never>) =>
  Effect.flatMap(Effect.service(Mailer), (mailer) => mailer.send(message)).pipe(
    Effect.provide(mailerOver(binding)),
    Effect.exit,
  );

describe("CloudflareEmailMailerLive", () => {
  it.effect("hands the binding the message from the configured sender", () =>
    Effect.gen(function* () {
      const sent: Array<EmailBindingMessage> = [];
      yield* sendThrough(
        Layer.succeed(EmailBinding, {
          send: async (bindingMessage) => {
            sent.push(bindingMessage);
            return { messageId: "1" };
          },
        }),
      );

      deepStrictEqual(sent, [
        { from: { email: "noreply@example.com", name: "Example" }, ...message },
      ]);
    }),
  );

  it.effect("fails with MailDeliveryError when the binding refuses", () =>
    Effect.gen(function* () {
      const exit = yield* sendThrough(
        Layer.succeed(EmailBinding, {
          send: () => Promise.reject(new Error("E_SENDER_NOT_VERIFIED")),
        }),
      );

      deepStrictEqual(
        Exit.isFailure(exit) && exit.cause.reasons[0]?._tag === "Fail"
          ? exit.cause.reasons[0].error._tag
          : "succeeded",
        "MailDeliveryError",
      );
    }),
  );

  it.effect("refuses to build without the binding", () =>
    Effect.gen(function* () {
      const exit = yield* sendThrough(Layer.empty);

      deepStrictEqual(Exit.hasDies(exit), true);
    }),
  );
});
