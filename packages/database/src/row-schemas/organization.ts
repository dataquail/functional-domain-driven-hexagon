import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const OrganizationRow = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  name: Schema.String,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
  deleted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
});
export type OrganizationRow = typeof OrganizationRow.Type;

export const OrganizationRowStd: StandardSchemaV1<unknown, OrganizationRow> =
  Schema.toStandardSchemaV1(OrganizationRow);

export const MembershipRow = Schema.Struct({
  user_id: Schema.String.check(Schema.isUUID()),
  organization_id: Schema.String.check(Schema.isUUID()),
  created_at: Schema.DateTimeUtcFromDate,
});
export type MembershipRow = typeof MembershipRow.Type;

export const MembershipRowStd: StandardSchemaV1<unknown, MembershipRow> =
  Schema.toStandardSchemaV1(MembershipRow);

export const InvitationRow = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  organization_id: Schema.String.check(Schema.isUUID()),
  invitee_email: Schema.String,
  token: Schema.String,
  expires_at: Schema.DateTimeUtcFromDate,
  accepted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revoked_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  created_at: Schema.DateTimeUtcFromDate,
});
export type InvitationRow = typeof InvitationRow.Type;

export const InvitationRowStd: StandardSchemaV1<unknown, InvitationRow> =
  Schema.toStandardSchemaV1(InvitationRow);

export const OrganizationRoleRow = Schema.Struct({
  organization_id: Schema.String.check(Schema.isUUID()),
  user_id: Schema.String.check(Schema.isUUID()),
  role: Schema.String,
  issued_by: Schema.String.check(Schema.isUUID()),
  created_at: Schema.DateTimeUtcFromDate,
});
export type OrganizationRoleRow = typeof OrganizationRoleRow.Type;

export const OrganizationRoleRowStd: StandardSchemaV1<unknown, OrganizationRoleRow> =
  Schema.toStandardSchemaV1(OrganizationRoleRow);
