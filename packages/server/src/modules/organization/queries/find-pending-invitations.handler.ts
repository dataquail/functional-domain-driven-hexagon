import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { InvitationRootOps } from "@/modules/organization/domain/invitation.root.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation.repository.js";
import { type FindPendingInvitationsQuery } from "@/modules/organization/queries/find-pending-invitations.query.js";

export const findPendingInvitations = Effect.fn("findPendingInvitations")(function* (
  query: FindPendingInvitationsQuery,
) {
  const repo = yield* InvitationRepository;
  const now = yield* DateTime.now;
  const all = yield* repo.findManyByOrganizationId(query.organizationId);
  // Only open invitations belong on the pending list; accepted invitees
  // are members and revoked ones are gone. Status (pending/expired) is
  // derived against `now` so the UI can offer resend on lapsed invites.
  return all.filter(InvitationRootOps.isOpen).map((invitation) => ({
    invitationId: invitation.id,
    inviteeEmail: invitation.inviteeEmail,
    status: InvitationRootOps.statusAt(invitation, now),
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  }));
});
