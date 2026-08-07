import { Event } from "@org/cqrs";

import {
  walletCreatedSpanAttributes,
  walletCreditedSpanAttributes,
  walletDebitedSpanAttributes,
} from "@/modules/wallet/domain/wallet/wallet.events.js";

export const walletEventSpanAttributes = Event.spanAttributes({
  WalletCreated: walletCreatedSpanAttributes,
  WalletCredited: walletCreditedSpanAttributes,
  WalletDebited: walletDebitedSpanAttributes,
});
