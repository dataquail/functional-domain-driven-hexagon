import * as Layer from "effect/Layer";
import { WalletRepositoryLive } from "./infrastructure/wallet-repository-live.js";
import { UserEventAdapterLive } from "./interface/events/user-event-adapter.js";

// Cross-module event subscriptions go through the per-publisher
// adapter in `interface/events/<publisher>-event-adapter.ts` — an
// inbound port at the same architectural layer as HTTP endpoints, and
// the only place allowed to import `@/modules/<publisher>/index.js`.
// Handlers downstream of the adapter consume wallet-internal trigger
// types from `event-handlers/triggers/` (see ADR-0007 ACL pattern).
const EventSubscriptionsLive = UserEventAdapterLive.pipe(Layer.provide(WalletRepositoryLive));

export const WalletModuleLive = Layer.mergeAll(WalletRepositoryLive, EventSubscriptionsLive);
