import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import {
  type CreateWalletCommand,
  createWalletCommandSpanAttributes,
} from "@/modules/wallet/commands/create-wallet.command.js";
import { createWallet } from "@/modules/wallet/commands/create-wallet.handler.js";
import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/repositories/wallet.repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

type CreateWalletOutput = Effect.Effect<
  void,
  PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    CreateWalletCommand: {
      readonly command: CreateWalletCommand;
      readonly output: CreateWalletOutput;
    };
  }
}

export const walletCommandHandlers = commandHandlers({
  CreateWalletCommand: {
    handle: (cmd): CreateWalletOutput =>
      createWallet(cmd).pipe(Effect.provide(WalletRepositoryLive)),
    spanAttributes: createWalletCommandSpanAttributes,
  },
});
