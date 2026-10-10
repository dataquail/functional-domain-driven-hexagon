import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";

import { WalletId } from "./wallet.id.js";

export class WalletAlreadyExistsForOrganization extends Schema.TaggedError<WalletAlreadyExistsForOrganization>()(
  "WalletAlreadyExistsForOrganization",
  { organizationId: OrganizationId },
) {}

export class WalletNotFound extends Schema.TaggedError<WalletNotFound>()("WalletNotFound", {
  walletId: WalletId,
}) {}

export class WalletInsufficientFunds extends Schema.TaggedError<WalletInsufficientFunds>()(
  "WalletInsufficientFunds",
  {
    walletId: WalletId,
    balance: Schema.Finite,
    attemptedDebit: Schema.Finite,
  },
) {}

export class WalletInvalidAmount extends Schema.TaggedError<WalletInvalidAmount>()(
  "WalletInvalidAmount",
  {
    walletId: WalletId,
    // The rejected amount is what this error reports, and NaN or Infinity is one way to be rejected.
    // @effect-diagnostics-next-line schemaNumber:off
    amount: Schema.Number,
  },
) {}
