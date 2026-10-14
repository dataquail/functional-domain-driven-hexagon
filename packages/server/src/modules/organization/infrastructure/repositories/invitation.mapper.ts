import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id.js";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.js";
import { InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";

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
    acceptedAt: Option.fromNullOr(row.accepted_at),
    revokedAt: Option.fromNullOr(row.revoked_at),
    createdAt: row.created_at,
  });

const toNullableDate = (at: Option.Option<DateTime.Utc>) =>
  Option.getOrNull(Option.map(at, DateTime.toDate));

export const toPersistence = (invitation: InvitationRoot) => ({
  id: invitation.id,
  organization_id: invitation.organizationId,
  invitee_email: invitation.inviteeEmail,
  token: invitation.token,
  expires_at: DateTime.toDate(invitation.expiresAt),
  accepted_at: toNullableDate(invitation.acceptedAt),
  revoked_at: toNullableDate(invitation.revokedAt),
  created_at: DateTime.toDate(invitation.createdAt),
});
