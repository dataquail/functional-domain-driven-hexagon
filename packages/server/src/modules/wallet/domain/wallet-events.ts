import { DomainEvent } from "@/platform/ddd/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
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

export type WalletEvent = WalletCreated;
