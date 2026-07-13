import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

type Row = RowSchemas.InvitationRow;

// Resolves the specification field names the live repository filters on to
// physical columns of "organization".invitations. Only filterable scalar
// fields need an entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  id: "id",
  token: "token",
  organizationId: "organization_id",
  inviteeEmail: "invitee_email",
  acceptedAt: "accepted_at",
  revokedAt: "revoked_at",
} as const satisfies Partial<Record<keyof InvitationRoot, string>> & ColumnMap;

export const toDomain = (row: Row): InvitationRoot =>
  new InvitationRoot({
    id: InvitationId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    inviteeEmail: row.invitee_email,
    token: row.token,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly invitee_email: string;
  readonly token: string;
  readonly expires_at: Date;
  readonly accepted_at: Date | null;
  readonly revoked_at: Date | null;
  readonly created_at: Date;
};

export const toPersistence = (invitation: InvitationRoot): PersistenceRow => ({
  id: invitation.id,
  organization_id: invitation.organizationId,
  invitee_email: invitation.inviteeEmail,
  token: invitation.token,
  expires_at: DateTime.toDate(invitation.expiresAt),
  accepted_at: invitation.acceptedAt === null ? null : DateTime.toDate(invitation.acceptedAt),
  revoked_at: invitation.revokedAt === null ? null : DateTime.toDate(invitation.revokedAt),
  created_at: DateTime.toDate(invitation.createdAt),
});
