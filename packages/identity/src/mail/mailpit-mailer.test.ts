import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { verificationEmail } from "./identity-emails.js";
import { MailDeliveryError } from "./identity-mailer.js";
import { mailpitMailer } from "./mailpit-mailer.js";

const sender = { address: "noreply@localhost", name: "Effect Monorepo" };

const recordingFetch = (response: Response) => {
  const requests: Array<Request> = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(response);
  };
  return { fetch, requests };
};

describe("mailpitMailer", () => {
  it.effect("posts the message to Mailpit's send API in the shape it documents", () =>
    Effect.gen(function* () {
      const { fetch, requests } = recordingFetch(Response.json({ ID: "1" }));
      const mailer = mailpitMailer({ url: "http://localhost:8025", sender, fetch });

      yield* mailer.send(verificationEmail({ to: "ada@example.com", url: "http://x/verify?t=1" }));

      const [request] = requests;
      expect(request?.method).toBe("POST");
      expect(request?.url).toBe("http://localhost:8025/api/v1/send");
      expect(yield* Effect.promise(() => request?.json() ?? Promise.resolve(null))).toMatchObject({
        From: { Email: "noreply@localhost", Name: "Effect Monorepo" },
        To: [{ Email: "ada@example.com" }],
        Subject: "Verify your email address",
      });
    }),
  );

  it.effect("fails the send when Mailpit refuses it, so Better Auth reports the error", () =>
    Effect.gen(function* () {
      const { fetch } = recordingFetch(new Response("bad", { status: 400 }));
      const mailer = mailpitMailer({ url: "http://localhost:8025", sender, fetch });

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
      const fetch: typeof globalThis.fetch = () => Promise.reject(new Error("ECONNREFUSED"));
      const mailer = mailpitMailer({ url: "http://localhost:8025", sender, fetch });

      const error = yield* Effect.flip(
        mailer.send(verificationEmail({ to: "ada@example.com", url: "http://x" })),
      );

      expect(error.message).toContain("Mailpit unreachable");
    }),
  );
});
