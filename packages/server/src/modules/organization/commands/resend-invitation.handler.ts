import * as crypto from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type ResendInvitationCommand } from "@/modules/organization/commands/resend-invitation.command.js";
import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { InvitationMailer } from "@/modules/organization/domain/ports/clients/invitation-mailer.client.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Resend = re-issue: rotate the token and reset the expiry on an open
// invitation, then re-send the email with the fresh accept link. The
// previous link stops working. Reissue refuses accepted/revoked
// invitations (the aggregate enforces it), which the endpoint maps to
// 410 Gone — same shape as revoke.
export const resendInvitation = Effect.fn("resendInvitation")(function* (
  cmd: ResendInvitationCommand,
) {
  const repo = yield* InvitationRepository;
  const bus = yield* DomainEventBus;
  const invitationMailer = yield* InvitationMailer;
  const now = yield* DateTime.now;
  // Fresh opaque bearer credential (256 bits, base64url). Randomness is
  // impure, so it stays in the command (the shell), never the domain.
  const token = yield* Effect.sync(() => crypto.randomBytes(32).toString("base64url"));
  const expiresAt = DateTime.add(now, { seconds: cmd.ttlSeconds });

  const reissued = yield* Effect.gen(function* () {
    const invitation = yield* repo.findOne(InvitationSpecifications.withId(cmd.invitationId));
    if (invitation === null) {
      return yield* new InvitationNotFound({ invitationId: cmd.invitationId });
    }
    const result = yield* Effect.fromResult(
      InvitationRootOps.reissue(invitation, { token, expiresAt, now }),
    );
    yield* repo.updateOne(result.invitation);
    yield* bus.dispatch(result.events);
    return result.invitation;
  }).pipe(withUnitOfWork);

  yield* Effect.annotateCurrentSpan("invitation.id", cmd.invitationId);
  // Fire after the UoW commits (same rationale as inviteUser): the email
  // carries the new accept link; best-effort delivery in the adapter.
  yield* invitationMailer.send({ to: reissued.inviteeEmail, token, expiresAt });
});
