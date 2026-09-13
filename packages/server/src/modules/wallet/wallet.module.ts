import { OrganizationEventAdapterLive } from "./interface/events/organization.event-adapter.js";
import { WalletCommandsLive } from "./wallet.command-handlers.js";

export const WalletLayer = WalletCommandsLive;

export const WalletHttpLayer = OrganizationEventAdapterLive;
