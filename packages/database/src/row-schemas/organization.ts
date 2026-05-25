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
