import { walletCreatedSpanAttributes } from "@/modules/wallet/domain/wallet-events.js";
import { eventSpanAttributes } from "@/platform/ddd/domain-event-bus.js";

export const walletEventSpanAttributes = eventSpanAttributes({
  WalletCreated: walletCreatedSpanAttributes,
});
