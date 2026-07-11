import { OrganizationEventAdapterLive } from "./interface/events/organization.event-adapter.js";

// The wallet module's only inbound surface is the organization event
// adapter (`interface/events/`): it subscribes to `OrganizationCreated`
// and dispatches a `CreateWalletCommand` through the bus (ADR-0007). The
// adapter is bus-only, so its requirements (CommandBus, DomainEventBus,
// UnitOfWork) are satisfied at the composition root — the wallet
// repository is wired behind the CreateWallet command handler
// (`wallet.command-handlers.ts`), not here.
export const WalletModuleLive = OrganizationEventAdapterLive;
