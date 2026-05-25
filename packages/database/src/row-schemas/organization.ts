import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const OrganizationRow = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
  deleted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
});
export type OrganizationRow = typeof OrganizationRow.Type;

export const OrganizationRowStd: StandardSchemaV1<unknown, OrganizationRow> =
  Schema.standardSchemaV1(OrganizationRow);

export const MembershipRow = Schema.Struct({
  user_id: Schema.UUID,
  organization_id: Schema.UUID,
  created_at: Schema.DateTimeUtcFromDate,
});
export type MembershipRow = typeof MembershipRow.Type;

export const MembershipRowStd: StandardSchemaV1<unknown, MembershipRow> =
  Schema.standardSchemaV1(MembershipRow);

export const InvitationRow = Schema.Struct({
  id: Schema.UUID,
  organization_id: Schema.UUID,
  invitee_email: Schema.String,
  token: Schema.String,
  expires_at: Schema.DateTimeUtcFromDate,
  accepted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revoked_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  created_at: Schema.DateTimeUtcFromDate,
});
export type InvitationRow = typeof InvitationRow.Type;

export const InvitationRowStd: StandardSchemaV1<unknown, InvitationRow> =
  Schema.standardSchemaV1(InvitationRow);
