import { DomainEvent } from "@/platform/domain-event.js";
import { UserId } from "./user-id.js";
import { WalletId } from "./wallet-id.js";

export const WalletCreated = DomainEvent("WalletCreated", {
  walletId: WalletId,
  userId: UserId,
});
export type WalletCreated = typeof WalletCreated.Type;

export type WalletEvent = WalletCreated;
