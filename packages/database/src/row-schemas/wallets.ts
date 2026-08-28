import * as Schema from "effect/Schema";

export const WalletRow = Schema.Struct({
  id: Schema.String.check(Schema.isGUID()),
  organization_id: Schema.String.check(Schema.isGUID()),
  balance: Schema.Number,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
});
export type WalletRow = typeof WalletRow.Type;
