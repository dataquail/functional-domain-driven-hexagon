import * as Layer from "effect/Layer";
import { CreateWalletWhenUserIsCreatedLive } from "./application/event-handlers/create-wallet-when-user-is-created.js";
import { WalletRepositoryLive } from "./infrastructure/wallet-repository-live.js";

const EventSubscriptionsLive = CreateWalletWhenUserIsCreatedLive.pipe(
  Layer.provide(WalletRepositoryLive),
);

export const WalletModuleLive = Layer.mergeAll(WalletRepositoryLive, EventSubscriptionsLive);
