import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletId } from "./wallet.id.js";

export class WalletAlreadyExistsForOrganization extends Schema.TaggedErrorClass<WalletAlreadyExistsForOrganization>(
  "WalletAlreadyExistsForOrganization",
)("WalletAlreadyExistsForOrganization", { organizationId: OrganizationId }) {}

export class WalletNotFound extends Schema.TaggedErrorClass<WalletNotFound>("WalletNotFound")(
  "WalletNotFound",
  { walletId: WalletId },
) {}

export class WalletInsufficientFunds extends Schema.TaggedErrorClass<WalletInsufficientFunds>(
  "WalletInsufficientFunds",
)("WalletInsufficientFunds", {
  walletId: WalletId,
  balance: Schema.Finite,
  attemptedDebit: Schema.Finite,
}) {}

export class WalletInvalidAmount extends Schema.TaggedErrorClass<WalletInvalidAmount>(
  "WalletInvalidAmount",
)("WalletInvalidAmount", {
  walletId: WalletId,
  // The rejected amount is what this error reports, and NaN or Infinity is one way to be rejected.
  // @effect-diagnostics-next-line schemaNumber:off
  amount: Schema.Number,
}) {}
