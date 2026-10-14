import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";

import { MailDeliveryError } from "../ports/mail-errors.ts";
import { Mailer } from "../ports/mailer.ts";

// Mailpit's HTTP send API; read delivered mail at MAILPIT_URL.
export const MailpitMailerLive: Layer.Layer<Mailer, never, EnvVars | HttpClient.HttpClient> =
  Layer.effect(
    Mailer,
    Effect.gen(function* () {
      const env = yield* EnvVars;
      const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
      const sendUrl = new URL("/api/v1/send", env.MAILPIT_URL).toString();

      return Mailer.of({
        send: Effect.fn("MailpitMailer.send")(function* (message) {
          yield* HttpClientRequest.post(sendUrl).pipe(
            HttpClientRequest.bodyJsonUnsafe({
              From: { Email: env.MAIL_FROM_ADDRESS, Name: env.MAIL_FROM_NAME },
              To: [{ Email: message.to }],
              Subject: message.subject,
              Text: message.text,
              HTML: message.html,
            }),
            client.execute,
            Effect.mapError(
              (cause) =>
                new MailDeliveryError({ message: `Mailpit send failed: ${cause.message}` }),
            ),
          );
        }),
      });
    }),
  );

export const MailpitMailerFetchLive = MailpitMailerLive.pipe(Layer.provide(FetchHttpClient.layer));
