import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";

// ADR-0022 outbound port. The invite use case asks "send the invitation
// email" without knowing how the link is shaped, what the message looks
// like, or which transport carries it — the adapter in
// `infrastructure/clients/` owns all of that (it builds the accept URL
// from `APP_URL`, renders the React Email template, and forwards to the
// platform `Mailer`).
//
// The surface is intentionally `Effect<void>` (no error channel):
// invitation email is best-effort. The invitation row is already
// committed by the time we send, so a transport failure must not fail
// the request — the adapter logs it and the admin can re-invite. The
// transport-level `MailDeliveryError` is modeled one layer down at the
// platform `Mailer` port; this port deliberately absorbs it.
export type SendInvitationInput = {
  readonly to: string;
  // Bearer token the invitee presents to accept. The adapter composes the
  // accept URL; the use case never spells out the link format.
  readonly token: string;
  readonly expiresAt: DateTime.Utc;
};

export type InvitationMailerShape = {
  readonly send: (input: SendInvitationInput) => Effect.Effect<void>;
};

export class InvitationMailer extends Context.Service<InvitationMailer, InvitationMailerShape>()(
  "@org/server/organization/InvitationMailer",
) {}
