import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import { HttpClientError, TransportError } from "effect/http/HttpClientError";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import { verificationEmail } from "./identity-emails.js";
import { MailDeliveryError } from "./identity-mailer.js";
import { mailpitMailer, MailpitMessage } from "./mailpit-mailer.js";

const sender = { address: "noreply@localhost", name: "Effect Monorepo" };

const decodeSentMessage = Schema.decodeUnknownOption(Schema.fromJsonString(MailpitMessage));

const answering = (response: Response) => {
  const requests: Array<HttpClientRequest.HttpClientRequest> = [];

  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      requests.push(request);

      return HttpClientResponse.fromWeb(request, response.clone());
    }),
  );

  return { client, requests };
};

const sentMessage = ({ body }: HttpClientRequest.HttpClientRequest) => {
  if (!Predicate.isTagged(body, "Uint8Array")) return Option.none();

  return decodeSentMessage(new TextDecoder().decode(body.body));
};

describe("mailpitMailer", () => {
  it.effect("posts the message to Mailpit's send API in the shape it documents", () =>
    Effect.gen(function* () {
      const { client, requests } = answering(Response.json({ ID: "1" }));
      const mailer = mailpitMailer({ url: "http://localhost:8025", sender, client });

      yield* mailer.send(verificationEmail({ to: "ada@example.com", url: "http://x/verify?t=1" }));

      const [request] = requests;
      expect(request?.method).toBe("POST");
      expect(request?.url).toBe("http://localhost:8025/api/v1/send");
      expect(Option.flatMap(Option.fromUndefinedOr(request), sentMessage)).toMatchObject(
        Option.some({
          From: { Email: "noreply@localhost", Name: "Effect Monorepo" },
          To: [{ Email: "ada@example.com" }],
          Subject: "Verify your email address",
        }),
      );
    }),
  );

  it.effect("fails the send when Mailpit refuses it, so Better Auth reports the error", () =>
    Effect.gen(function* () {
      const { client } = answering(new Response("bad", { status: 400 }));
      const mailer = mailpitMailer({ url: "http://localhost:8025", sender, client });

      const error = yield* Effect.flip(
        mailer.send(verificationEmail({ to: "ada@example.com", url: "http://x" })),
      );

      expect(error).toEqual(
        new MailDeliveryError({ message: "Mailpit refused the message: 400 bad" }),
      );
    }),
  );

  it.effect("fails the send when Mailpit cannot be reached", () =>
    Effect.gen(function* () {
      const client = HttpClient.make(
        (request) =>
          new HttpClientError({
            reason: new TransportError({ request, description: "ECONNREFUSED" }),
          }),
      );

      const mailer = mailpitMailer({ url: "http://localhost:8025", sender, client });

      const error = yield* Effect.flip(
        mailer.send(verificationEmail({ to: "ada@example.com", url: "http://x" })),
      );

      expect(error.message).toContain("Mailpit unreachable");
    }),
  );
});
