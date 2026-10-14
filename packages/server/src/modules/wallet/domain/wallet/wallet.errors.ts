import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";

import { WalletId } from "./wallet.id";

export class WalletAlreadyExistsForOrganization extends Schema.TaggedError<
  WalletAlreadyExistsForOrganization,
  { readonly brand: "WalletAlreadyExistsForOrganization" }
>()("WalletAlreadyExistsForOrganization", { organizationId: OrganizationId }) {}

export class WalletNotFound extends Schema.TaggedError<
  WalletNotFound,
  { readonly brand: "WalletNotFound" }
>()("WalletNotFound", {
  walletId: WalletId,
}) {}

export class WalletInsufficientFunds extends Schema.TaggedError<
  WalletInsufficientFunds,
  { readonly brand: "WalletInsufficientFunds" }
>()("WalletInsufficientFunds", {
  walletId: WalletId,
  balance: Schema.Finite,
  attemptedDebit: Schema.Finite,
}) {}

export class WalletInvalidAmount extends Schema.TaggedError<
  WalletInvalidAmount,
  { readonly brand: "WalletInvalidAmount" }
>()("WalletInvalidAmount", {
  walletId: WalletId,
  // @effect-diagnostics-next-line schemaNumber:off -- NaN and Infinity are rejected amounts this error reports
  amount: Schema.Number,
}) {}
