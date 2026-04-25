import { DomainEvent } from "@/platform/domain-event-bus.js";
import { UserId, WalletId } from "@org/contracts/EntityIds";

export const WalletCreated = DomainEvent("WalletCreated", {
  walletId: WalletId,
  userId: UserId,
});
export type WalletCreated = typeof WalletCreated.Type;

export type WalletEvent = WalletCreated;
