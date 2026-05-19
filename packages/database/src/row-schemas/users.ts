import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const UserRow = Schema.Struct({
  id: Schema.UUID,
  email: Schema.String,
  is_super_admin: Schema.Boolean,
  country: Schema.String,
  street: Schema.String,
  postal_code: Schema.String,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
});
export type UserRow = typeof UserRow.Type;

export const UserRowStd: StandardSchemaV1<unknown, UserRow> = Schema.standardSchemaV1(UserRow);
