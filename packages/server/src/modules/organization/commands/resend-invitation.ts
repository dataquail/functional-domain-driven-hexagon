import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { generateInvitationToken } from "@/modules/organization/commands/invitation-token.js";
import {
  type ResendInvitationCommand,
  type ResendInvitationOutput,
} from "@/modules/organization/commands/resend-invitation-command.js";
import * as Invitation from "@/modules/organization/domain/invitation.aggregate.js";
import { InvitationMailer } from "@/modules/organization/domain/ports/external/invitation-mailer.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Resend = re-issue: rotate the token and reset the expiry on an open
// invitation, then re-send the email with the fresh accept link. The
// previous link stops working. Reissue refuses accepted/revoked
// invitations (the aggregate enforces it), which the endpoint maps to
// 410 Gone — same shape as revoke.
export const resendInvitation = (cmd: ResendInvitationCommand): ResendInvitationOutput =>
  Effect.gen(function* () {
    const repo = yield* InvitationRepository;
    const bus = yield* DomainEventBus;
    const invitationMailer = yield* InvitationMailer;
    const now = yield* DateTime.now;
    const token = generateInvitationToken();
    const expiresAt = DateTime.add(now, { seconds: cmd.ttlSeconds });

    const reissued = yield* Effect.gen(function* () {
      const invitation = yield* repo.findOneById(cmd.invitationId);
      const result = yield* Invitation.reissue(invitation, { token, expiresAt, now });
      yield* repo.updateOne(result.invitation);
      yield* bus.dispatch(result.events);
      return result.invitation;
    }).pipe(withUnitOfWork);

    yield* Effect.annotateCurrentSpan("invitation.id", cmd.invitationId);
    // Fire after the UoW commits (same rationale as inviteUser): the email
    // carries the new accept link; best-effort delivery in the adapter.
    yield* invitationMailer.send({ to: reissued.inviteeEmail, token, expiresAt });
  });
