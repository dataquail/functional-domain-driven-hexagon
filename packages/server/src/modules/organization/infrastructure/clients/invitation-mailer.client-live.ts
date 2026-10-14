import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars";
import { Mailer } from "@/globals/infrastructure/email/ports/mailer";
import { InvitationEmailUndelivered } from "@/modules/organization/domain/invitation/invitation.errors";
import { InvitationMailer } from "@/modules/organization/domain/ports/clients/invitation-mailer.client";

import { invitationEmail } from "./invitation.email";

const SUBJECT = "You're invited to join an organization";

// ADR-0022 outbound adapter for `InvitationMailer`. Owns everything the
// use case shouldn't know: the accept-URL shape (`APP_URL` + token), the
// email template. A transport failure surfaces as the domain's own error,
// so the after-commit delivery retries the email instead of losing it.
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

          const { html, text } = invitationEmail({ acceptUrl, expiresLabel });

          yield* mailer
            .send({ to, subject: SUBJECT, html, text })
            .pipe(
              Effect.mapError(
                (error) => new InvitationEmailUndelivered({ message: error.message }),
              ),
            );
        }),
    });
  }),
);
