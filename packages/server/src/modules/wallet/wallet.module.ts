import * as Layer from "effect/Layer";

import { WalletRepositoryLive } from "./infrastructure/repositories/wallet.repository-live.js";
import { OrganizationEventAdapterLive } from "./interface/events/organization.event-adapter.js";

// Cross-module event subscriptions go through the per-publisher
// adapter in `interface/events/<publisher>-event-adapter.ts` — an
// inbound port at the same architectural layer as HTTP endpoints, and
// the only place allowed to import `@/modules/<publisher>/index.js`.
// Handlers downstream of the adapter consume wallet-internal trigger
// types from `event-handlers/triggers/` (see ADR-0007 ACL pattern).
export const WalletModuleLive = OrganizationEventAdapterLive.pipe(
  Layer.provide(WalletRepositoryLive),
);
