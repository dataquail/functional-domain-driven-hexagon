import { render } from "@react-email/render";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { createElement } from "react";

import { EnvVars } from "@/common/env-vars.js";
import { InvitationMailer } from "@/modules/organization/domain/ports/clients/invitation-mailer.client.js";
import { Mailer } from "@/platform/notifications/mailer.js";

import { InvitationEmail } from "./invitation.email.js";

const SUBJECT = "You're invited to join an organization";

// ADR-0023 outbound adapter for `InvitationMailer`. Owns everything the
// use case shouldn't know: the accept-URL shape (`APP_URL` + token), the
// React Email template, and the decision to treat delivery as
// best-effort. A transport `MailDeliveryError` is logged and swallowed
// so a flaky relay can't fail an invite whose row is already committed.
export const InvitationMailerLive = Layer.effect(
  InvitationMailer,
  Effect.gen(function* () {
    const mailer = yield* Mailer;
    const env = yield* EnvVars;

    return InvitationMailer.of({
      send: ({ expiresAt, to, token }) =>
        Effect.gen(function* () {
          // The accept page (web `(authed)/invitations/[token]`) is reached
          // at this URL; the (authed) guard bounces an unauthenticated
          // invitee through sign-in and back.
          const acceptUrl = `${env.APP_URL}/invitations/${token}`;
          const expiresLabel = DateTime.format(expiresAt, {
            dateStyle: "medium",
            timeStyle: "short",
          });
          const element = createElement(InvitationEmail, { acceptUrl, expiresLabel });
          const html = yield* Effect.promise(() => render(element));
          const text = yield* Effect.promise(() => render(element, { plainText: true }));

          yield* mailer
            .send({ to, subject: SUBJECT, html, text })
            .pipe(
              Effect.catchTag("MailDeliveryError", (error) =>
                Effect.logError("Invitation email delivery failed", { to, reason: error.message }),
              ),
            );
        }),
    });
  }),
);
