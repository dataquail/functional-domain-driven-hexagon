import { OrganizationEventAdapterLive } from "./interface/events/organization.event-adapter";
import { WalletCommandsLive } from "./wallet.command-handlers";

export const WalletModule = {
  layer: WalletCommandsLive,
  events: OrganizationEventAdapterLive,
};
