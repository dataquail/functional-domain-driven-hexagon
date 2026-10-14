import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { type SendInvitationEmailPayload } from "@/modules/organization/commands/send-invitation-email.command";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification";
import { InvitationMailer } from "@/modules/organization/domain/ports/clients/invitation-mailer.client";

// Reads the invitation back rather than being handed its token, because this runs
// after the issuing transaction committed and the token must not travel on an
// event. A row that has since vanished means the invitation was revoked between
// the commit and now: there is nothing to send, and no caller left to tell.
//
// No `withUnitOfWork`: the post-commit flush already runs each reaction in its own
// unit of work, and this one only reads.
export const sendInvitationEmailHandler = Effect.fn("sendInvitationEmailHandler")(function* (
  cmd: SendInvitationEmailPayload,
) {
  const repo = yield* InvitationRepository;
  const mailer = yield* InvitationMailer;

  const maybeInvitation = yield* repo.findOne(InvitationSpecifications.withId(cmd.invitationId));

  if (Option.isNone(maybeInvitation)) return;

  const invitation = maybeInvitation.value;

  yield* mailer.send({
    to: invitation.inviteeEmail,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
  });
});
