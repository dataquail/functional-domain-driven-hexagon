import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { type InvitationStatus } from "@/modules/organization/domain/invitation.root.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Pending-invitations roster for the member-management surface: every
// *open* invitation (not yet accepted, not revoked) for the org, each
// tagged pending vs expired so the UI can flag lapsed ones for resend.
// Accepted invitees show up in the members list instead; revoked ones
// are gone. The handler reads the repo and derives status against now.
export const FindPendingInvitationsQuery = Schema.TaggedStruct("FindPendingInvitationsQuery", {
  organizationId: OrganizationId,
});
export type FindPendingInvitationsQuery = typeof FindPendingInvitationsQuery.Type;

export const findPendingInvitationsQuerySpanAttributes: SpanAttributesExtractor<
  FindPendingInvitationsQuery
> = (query) => ({ "organization.id": query.organizationId });

export type PendingInvitationView = {
  readonly invitationId: InvitationId;
  readonly inviteeEmail: string;
  readonly status: InvitationStatus;
  readonly expiresAt: DateTime.Utc;
  readonly createdAt: DateTime.Utc;
};
