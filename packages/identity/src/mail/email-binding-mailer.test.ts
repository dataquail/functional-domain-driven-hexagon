import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { emailBindingMailer, type EmailSendingBinding } from "./email-binding-mailer.js";
import { passwordResetEmail } from "./identity-emails.js";

type SentMessage = Parameters<EmailSendingBinding["send"]>[0];

describe("emailBindingMailer", () => {
  it.effect("hands the message to the Email binding from the configured sender", () =>
    Effect.gen(function* () {
      const sent: Array<SentMessage> = [];
      const binding: EmailSendingBinding = {
        send: (message) => {
          sent.push(message);
          return Promise.resolve({ messageId: "m1" });
        },
      };
      const mailer = emailBindingMailer(binding, { address: "auth@example.com", name: "Auth" });

      yield* mailer.send(passwordResetEmail({ to: "ada@example.com", url: "https://x/reset" }));

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        from: { email: "auth@example.com", name: "Auth" },
        to: "ada@example.com",
        subject: "Reset your password",
      });
      expect(sent[0]?.text).toContain("https://x/reset");
    }),
  );

  it.effect("fails the send when the binding refuses the message", () =>
    Effect.gen(function* () {
      const binding: EmailSendingBinding = {
        send: () => Promise.reject(new Error("destination not verified")),
      };
      const mailer = emailBindingMailer(binding, { address: "auth@example.com", name: "Auth" });

      const error = yield* Effect.flip(
        mailer.send(passwordResetEmail({ to: "ada@example.com", url: "https://x/reset" })),
      );

      expect(error.message).toContain("destination not verified");
    }),
  );
});
