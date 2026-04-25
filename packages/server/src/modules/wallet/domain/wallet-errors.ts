import { UserId, WalletId } from "@org/contracts/EntityIds";
import * as Schema from "effect/Schema";

export class WalletAlreadyExistsForUser extends Schema.TaggedError<WalletAlreadyExistsForUser>(
  "WalletAlreadyExistsForUser",
)("WalletAlreadyExistsForUser", { userId: UserId }) {}

export class WalletNotFound extends Schema.TaggedError<WalletNotFound>("WalletNotFound")(
  "WalletNotFound",
  { walletId: WalletId },
) {}
