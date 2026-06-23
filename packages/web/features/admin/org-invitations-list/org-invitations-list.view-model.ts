// View-model for the pending-invitations section of the member-
// management surface. Maps the contract's invitation rows into the row
// shape the leaf renders, with a formatted expiry label and an
// `isExpired` flag driving the status badge. The date formatter is
// defensive about the DateTime shape for the same reason as the
// members view-model: dehydrate strips DateTime.Utc to ISO strings.

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { InvitationId } from "@org/contracts/EntityIds";

export type InvitationRowView = {
  readonly invitationId: InvitationId;
  readonly email: string;
  readonly isExpired: boolean;
  readonly expiresAtLabel: string;
};

export type OrgInvitationsListView = {
  readonly rows: ReadonlyArray<InvitationRowView>;
  readonly isEmpty: boolean;
};

const formatDate = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "epochMillis" in value) {
    const millis = value.epochMillis;
    if (typeof millis === "number" && Number.isFinite(millis)) {
      return new Date(millis).toISOString().slice(0, 10);
    }
  }
  return "";
};

export const computeOrgInvitationsListView = (
  response: OrganizationContract.PendingInvitationsResponse,
): OrgInvitationsListView => {
  const rows = response.invitations.map((invitation) => ({
    invitationId: invitation.invitationId,
    email: invitation.inviteeEmail,
    isExpired: invitation.status === "expired",
    expiresAtLabel: formatDate(invitation.expiresAt),
  }));
  return { rows, isEmpty: rows.length === 0 };
};
