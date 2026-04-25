import * as Schema from "effect/Schema";
import { UserId } from "./user-id.js";
import { WalletId } from "./wallet-id.js";

export class WalletAlreadyExistsForUser extends Schema.TaggedError<WalletAlreadyExistsForUser>(
  "WalletAlreadyExistsForUser",
)("WalletAlreadyExistsForUser", { userId: UserId }) {}

export class WalletNotFound extends Schema.TaggedError<WalletNotFound>("WalletNotFound")(
  "WalletNotFound",
  { walletId: WalletId },
) {}
