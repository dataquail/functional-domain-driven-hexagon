import { Module } from "@org/module";

import { OrganizationEventAdapterLive } from "./interface/events/organization.event-adapter.js";
import { WalletCommandsLive } from "./wallet.command-handlers.js";

// The wallet module's only inbound surface is the organization event adapter
// (`interface/events/`): it subscribes to `OrganizationCreated` and dispatches a
// `CreateWalletCommand` through the bus (ADR-0007). The adapter is bus-only, so
// the wallet repository is wired behind the command handler, not here.
export const WalletModule = Module.make()("wallet", WalletCommandsLive, {
  http: OrganizationEventAdapterLive,
});
