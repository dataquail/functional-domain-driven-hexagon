import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import { type OutgoingEmail } from "./email-binding-mailer";
import { MailDeliveryError } from "./identity-mailer";
import { deliveryThroughSes } from "./ses-delivery";

const credentials = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  sessionToken: "session-token",
  region: "us-east-2",
};

const message: OutgoingEmail = {
  from: { email: "auth@example.com", name: "Auth" },
  to: "ada@example.com",
  subject: "Reset your password",
  text: "plain",
  html: "<p>html</p>",
};

const decodeJson = Schema.decodeSync(Schema.fromJsonString(Schema.Json));

type Sent = { url: string; headers: Readonly<Record<string, string>>; body: string };

const bodyText = (body: HttpBody.HttpBody): string => {
  if (Predicate.isTagged(body, "Uint8Array")) return new TextDecoder().decode(body.body);

  return "";
};

const sesAnswering = (status: number, sent: Array<Sent>) =>
  HttpClient.make((request) => {
    sent.push({ url: request.url, headers: request.headers, body: bodyText(request.body) });

    return Effect.succeed(HttpClientResponse.fromWeb(request, new Response("{}", { status })));
  });

describe("deliveryThroughSes", () => {
  it.effect("posts a signed SES v2 SendEmail from the configured sender", () =>
    Effect.gen(function* () {
      const sent: Array<Sent> = [];

      yield* deliveryThroughSes(credentials, sesAnswering(200, sent))(message);

      expect(sent).toHaveLength(1);
      expect(sent[0]?.url).toBe("https://email.us-east-2.amazonaws.com/v2/email/outbound-emails");
      expect(sent[0]?.headers.authorization).toMatch(
        /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-2\/ses\/aws4_request/,
      );
      expect(sent[0]?.headers["x-amz-security-token"]).toBe("session-token");
      expect(decodeJson(sent[0]?.body ?? "")).toMatchObject({
        FromEmailAddress: '"Auth" <auth@example.com>',
        Destination: { ToAddresses: ["ada@example.com"] },
        Content: { Simple: { Subject: { Data: "Reset your password" } } },
      });
    }),
  );

  it.effect("fails the send when SES refuses the message", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        deliveryThroughSes(credentials, sesAnswering(400, []))(message),
      );

      expect(error).toBeInstanceOf(MailDeliveryError);
    }),
  );
});
