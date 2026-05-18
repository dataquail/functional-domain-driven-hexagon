import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { WalletId } from "./wallet-id.js";

export class WalletAlreadyExistsForUser extends Schema.TaggedError<WalletAlreadyExistsForUser>(
  "WalletAlreadyExistsForUser",
)("WalletAlreadyExistsForUser", { userId: UserId }) {}

export class WalletNotFound extends Schema.TaggedError<WalletNotFound>("WalletNotFound")(
  "WalletNotFound",
  { walletId: WalletId },
) {}

export class WalletInsufficientFunds extends Schema.TaggedError<WalletInsufficientFunds>(
  "WalletInsufficientFunds",
)("WalletInsufficientFunds", {
  walletId: WalletId,
  balance: Schema.Number,
  attemptedDebit: Schema.Number,
}) {}

export class WalletInvalidAmount extends Schema.TaggedError<WalletInvalidAmount>(
  "WalletInvalidAmount",
)("WalletInvalidAmount", {
  walletId: WalletId,
  amount: Schema.Number,
}) {}
