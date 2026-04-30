import { DomainEvent } from "@/platform/domain-event.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
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
