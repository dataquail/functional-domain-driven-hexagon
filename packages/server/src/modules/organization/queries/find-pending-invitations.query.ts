import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Display status of an open invitation, derived on the read path from
// `expiresAt` vs now: still live (`pending`) or lapsed (`expired`).
export const PendingInvitationStatus = Schema.Literals(["pending", "expired"]);
export type PendingInvitationStatus = typeof PendingInvitationStatus.Type;

export const PendingInvitationView = Schema.Struct({
  invitationId: InvitationId,
  inviteeEmail: Schema.String,
  status: PendingInvitationStatus,
  expiresAt: Schema.DateTimeUtc,
  createdAt: Schema.DateTimeUtc,
});
export type PendingInvitationView = typeof PendingInvitationView.Type;

// Pending-invitations roster for the member-management surface: every
// *open* invitation (not yet accepted, not revoked) for the org, each
// tagged pending vs expired so the UI can flag lapsed ones for resend.
// Accepted invitees show up in the members list instead; revoked ones
// are gone. The handler reads the repo and derives status against now.
export const FindPendingInvitations = Query.make("FindPendingInvitationsQuery", {
  payload: { organizationId: OrganizationId },
  success: Schema.Array(PendingInvitationView),
  failure: PersistenceUnavailable,
});
export type FindPendingInvitationsPayload = Query.Payload<typeof FindPendingInvitations>;
