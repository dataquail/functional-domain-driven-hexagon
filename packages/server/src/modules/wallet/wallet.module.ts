import { OrganizationEventAdapterLive } from "./interface/events/organization.event-adapter.ts";
import { WalletCommandsLive } from "./wallet.command-handlers.ts";

export const WalletModule = {
  layer: WalletCommandsLive,
  events: OrganizationEventAdapterLive,
};
