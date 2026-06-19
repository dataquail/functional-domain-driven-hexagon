import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const UserRow = Schema.Struct({
  id: Schema.UUID,
  email: Schema.String,
  // Nullable since JIT provisioning: a user provisioned on first OIDC
  // sign-in has no address yet (only email + subject are known). The three
  // columns move together — a row either has a full address or none.
  country: Schema.NullOr(Schema.String),
  street: Schema.NullOr(Schema.String),
  postal_code: Schema.NullOr(Schema.String),
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
});
export type UserRow = typeof UserRow.Type;

export const UserRowStd: StandardSchemaV1<unknown, UserRow> = Schema.standardSchemaV1(UserRow);
