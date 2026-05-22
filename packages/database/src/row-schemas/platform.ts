import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const PlatformRoleRow = Schema.Struct({
  user_id: Schema.UUID,
  role: Schema.String,
  granted_at: Schema.DateTimeUtcFromDate,
});
export type PlatformRoleRow = typeof PlatformRoleRow.Type;

export const PlatformRoleRowStd: StandardSchemaV1<unknown, PlatformRoleRow> =
  Schema.standardSchemaV1(PlatformRoleRow);
