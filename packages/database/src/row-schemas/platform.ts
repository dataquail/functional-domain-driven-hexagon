import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const PlatformRoleRow = Schema.Struct({
  user_id: Schema.String.check(Schema.isGUID()),
  role: Schema.String,
  granted_at: Schema.DateTimeUtcFromDate,
});
export type PlatformRoleRow = typeof PlatformRoleRow.Type;

export const PlatformRoleRowStd: StandardSchemaV1<unknown, PlatformRoleRow> =
  Schema.toStandardSchemaV1(PlatformRoleRow);
