import {
  walletCreatedSpanAttributes,
  walletCreditedSpanAttributes,
  walletDebitedSpanAttributes,
} from "@/modules/wallet/domain/wallet/wallet.events.js";
import { eventSpanAttributes } from "@/platform/ddd/ports/domain-event-bus.js";

export const walletEventSpanAttributes = eventSpanAttributes({
  WalletCreated: walletCreatedSpanAttributes,
  WalletCredited: walletCreditedSpanAttributes,
  WalletDebited: walletDebitedSpanAttributes,
});
