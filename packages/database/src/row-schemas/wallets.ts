import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const WalletRow = Schema.Struct({
  id: Schema.UUID,
  user_id: Schema.UUID,
  balance: Schema.Number,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
});
export type WalletRow = typeof WalletRow.Type;

export const WalletRowStd: StandardSchemaV1<unknown, WalletRow> =
  Schema.standardSchemaV1(WalletRow);
