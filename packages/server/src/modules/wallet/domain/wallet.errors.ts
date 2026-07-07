import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletId } from "./wallet.id.js";

export class WalletAlreadyExistsForOrganization extends Schema.TaggedError<WalletAlreadyExistsForOrganization>(
  "WalletAlreadyExistsForOrganization",
)("WalletAlreadyExistsForOrganization", { organizationId: OrganizationId }) {}

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
