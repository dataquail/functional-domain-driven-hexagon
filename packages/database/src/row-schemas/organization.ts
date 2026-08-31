import * as Schema from "effect/Schema";

export const OrganizationRow = Schema.Struct({
  id: Schema.String.check(Schema.isGUID()),
  name: Schema.String,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
  deleted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
});
export type OrganizationRow = typeof OrganizationRow.Type;

export const MembershipRow = Schema.Struct({
  user_id: Schema.String.check(Schema.isGUID()),
  organization_id: Schema.String.check(Schema.isGUID()),
  created_at: Schema.DateTimeUtcFromDate,
});
export type MembershipRow = typeof MembershipRow.Type;

export const InvitationRow = Schema.Struct({
  id: Schema.String.check(Schema.isGUID()),
  organization_id: Schema.String.check(Schema.isGUID()),
  invitee_email: Schema.String,
  token: Schema.String,
  expires_at: Schema.DateTimeUtcFromDate,
  accepted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revoked_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  created_at: Schema.DateTimeUtcFromDate,
});
export type InvitationRow = typeof InvitationRow.Type;

export const OrganizationRoleRow = Schema.Struct({
  organization_id: Schema.String.check(Schema.isGUID()),
  user_id: Schema.String.check(Schema.isGUID()),
  role: Schema.String,
  issued_by: Schema.String.check(Schema.isGUID()),
  created_at: Schema.DateTimeUtcFromDate,
});
export type OrganizationRoleRow = typeof OrganizationRoleRow.Type;
