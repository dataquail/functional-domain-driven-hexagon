import * as Schema from "effect/Schema";

import { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

import { WalletId } from "./wallet-id.js";

export const WalletCreated = DomainEvent("WalletCreated", {
  walletId: WalletId,
  userId: UserId,
});
export type WalletCreated = typeof WalletCreated.Type;

export const walletCreatedSpanAttributes: SpanAttributesExtractor<WalletCreated> = (event) => ({
  "wallet.id": event.walletId,
  "user.id": event.userId,
});

export const WalletCredited = DomainEvent("WalletCredited", {
  walletId: WalletId,
  amount: Schema.Number,
  newBalance: Schema.Number,
});
export type WalletCredited = typeof WalletCredited.Type;

export const walletCreditedSpanAttributes: SpanAttributesExtractor<WalletCredited> = (event) => ({
  "wallet.id": event.walletId,
  "wallet.amount": event.amount,
  "wallet.new_balance": event.newBalance,
});

export const WalletDebited = DomainEvent("WalletDebited", {
  walletId: WalletId,
  amount: Schema.Number,
  newBalance: Schema.Number,
});
export type WalletDebited = typeof WalletDebited.Type;

export const walletDebitedSpanAttributes: SpanAttributesExtractor<WalletDebited> = (event) => ({
  "wallet.id": event.walletId,
  "wallet.amount": event.amount,
  "wallet.new_balance": event.newBalance,
});

export type WalletEvent = WalletCreated | WalletCredited | WalletDebited;
