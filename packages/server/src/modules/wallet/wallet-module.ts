import * as Layer from "effect/Layer";
import { UserEventAdapterLive } from "./event-handlers/user-event-adapter.js";
import { WalletRepositoryLive } from "./infrastructure/wallet-repository-live.js";

// Cross-module event subscriptions go through the per-publisher
// adapter in `event-handlers/<publisher>-event-adapter.ts` — the only
// file allowed to import `@/modules/<publisher>/index.js`. Handlers
// downstream of the adapter consume wallet-internal trigger types
// from `event-handlers/triggers/` (see Phase 11 / ADR-0007 ACL
// pattern).
const EventSubscriptionsLive = UserEventAdapterLive.pipe(Layer.provide(WalletRepositoryLive));

export const WalletModuleLive = Layer.mergeAll(WalletRepositoryLive, EventSubscriptionsLive);
