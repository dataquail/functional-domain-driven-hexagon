import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const AuthIdentityRow = Schema.Struct({
  subject: Schema.String,
  user_id: Schema.UUID,
  provider: Schema.String,
  created_at: Schema.DateTimeUtcFromDate,
});
export type AuthIdentityRow = typeof AuthIdentityRow.Type;

export const AuthIdentityRowStd: StandardSchemaV1<unknown, AuthIdentityRow> =
  Schema.standardSchemaV1(AuthIdentityRow);

export const SessionRow = Schema.Struct({
  id: Schema.UUID,
  user_id: Schema.UUID,
  subject: Schema.String,
  expires_at: Schema.DateTimeUtcFromDate,
  absolute_expires_at: Schema.DateTimeUtcFromDate,
  revoked_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  created_at: Schema.DateTimeUtcFromDate,
  last_used_at: Schema.DateTimeUtcFromDate,
});
export type SessionRow = typeof SessionRow.Type;

export const SessionRowStd: StandardSchemaV1<unknown, SessionRow> =
  Schema.standardSchemaV1(SessionRow);

export const ApiTokenRow = Schema.Struct({
  id: Schema.UUID,
  user_id: Schema.UUID,
  token_hash: Schema.String,
  prefix: Schema.String,
  label: Schema.String,
  expires_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revoked_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  created_at: Schema.DateTimeUtcFromDate,
  last_used_at: Schema.DateTimeUtcFromDate,
});
export type ApiTokenRow = typeof ApiTokenRow.Type;

export const ApiTokenRowStd: StandardSchemaV1<unknown, ApiTokenRow> =
  Schema.standardSchemaV1(ApiTokenRow);

export const DeviceGrantRow = Schema.Struct({
  id: Schema.UUID,
  device_code_hash: Schema.String,
  user_code: Schema.String,
  status: Schema.String,
  user_id: Schema.NullOr(Schema.UUID),
  created_at: Schema.DateTimeUtcFromDate,
  expires_at: Schema.DateTimeUtcFromDate,
  approved_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
});
export type DeviceGrantRow = typeof DeviceGrantRow.Type;

export const DeviceGrantRowStd: StandardSchemaV1<unknown, DeviceGrantRow> =
  Schema.standardSchemaV1(DeviceGrantRow);
