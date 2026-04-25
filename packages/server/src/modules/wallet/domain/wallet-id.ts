import * as Schema from "effect/Schema";

export const WalletId = Schema.String.pipe(Schema.brand("WalletId"));
export type WalletId = typeof WalletId.Type;
