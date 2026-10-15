import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { emailBindingMailer, type EmailDelivery, type OutgoingEmail } from "./email-binding-mailer";
import { passwordResetEmail } from "./identity-emails";
import { MailDeliveryError } from "./identity-mailer";

const sender = { address: "auth@example.com", name: "Auth" };

describe("emailBindingMailer", () => {
  it.effect("hands the message to the Email binding from the configured sender", () =>
    Effect.gen(function* () {
      const sent: Array<OutgoingEmail> = [];

      const deliver: EmailDelivery = (message) =>
        Effect.sync(() => {
          sent.push(message);
        });

      yield* emailBindingMailer(deliver, sender).send(
        passwordResetEmail({ to: "ada@example.com", url: "https://x/reset" }),
      );

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
      const refusing: EmailDelivery = () =>
        new MailDeliveryError({ message: "Email binding refused: destination not verified" });

      const error = yield* Effect.flip(
        emailBindingMailer(refusing, sender).send(
          passwordResetEmail({ to: "ada@example.com", url: "https://x/reset" }),
        ),
      );

      expect(error.message).toContain("destination not verified");
    }),
  );
});
