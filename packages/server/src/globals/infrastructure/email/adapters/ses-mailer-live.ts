import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { sendEmail } from "@/globals/infrastructure/aws/ses-api";
import { EnvVars } from "@/globals/infrastructure/config/env-vars";

import { MailDeliveryError } from "../ports/mail-errors";
import { Mailer } from "../ports/mailer";

// Amazon SES, signed with the credentials of the Lambda's execution role.
export const SesMailerLive: Layer.Layer<Mailer, never, EnvVars | HttpClient.HttpClient> =
  Layer.effect(
    Mailer,
    Effect.gen(function* () {
      const env = yield* EnvVars;
      const client = yield* HttpClient.HttpClient;

      if (Option.isNone(env.AWS)) {
        return yield* Effect.die(new Error("MAILER=ses needs the AWS credentials of a Lambda"));
      }

      const credentials = env.AWS.value;
      const from = { email: env.MAIL_FROM_ADDRESS, name: env.MAIL_FROM_NAME };

      return Mailer.of({
        send: (message) =>
          sendEmail(credentials, {
            from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
          }).pipe(
            Effect.provideService(HttpClient.HttpClient, client),
            Effect.mapError(
              (error) => new MailDeliveryError({ message: `SES refused: ${error.message}` }),
            ),
          ),
      });
    }),
  );

export const SesMailerFetchLive = SesMailerLive.pipe(Layer.provide(FetchHttpClient.layer));
