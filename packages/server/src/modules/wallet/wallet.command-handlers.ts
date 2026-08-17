import { Command } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { createWalletHandler } from "@/modules/wallet/commands/create-wallet.handler.js";
import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/repositories/wallet.repository-live.js";

// The group is the module's slice of the write-side surface; `handlersOf` moves the
// handlers' requirements onto the layer, which is why the composition root — not a
// call site — satisfies them.
//
// Published so an integration test can stage this module's write side against
// alternative handlers (ADR-0009); the composition root reaches `WalletCommandsLive`
// instead and never reassembles the group itself.
export const walletCommandGroup = Command.group(CreateWalletCommand);

const WalletCommandHandlersLive = Command.handlersOf(walletCommandGroup, {
  CreateWalletCommand: (payload) =>
    createWalletHandler(payload).pipe(Effect.provide(WalletRepositoryLive)),
});

const walletCommandSpanAttributes: Command.SpanAttributes<typeof walletCommandGroup> = {
  CreateWalletCommand: (payload) => ({ "organization.id": payload.organizationId }),
};

/**
 * This module's slice of the write-side dispatch surface, published as a service so
 * another module's outbound ACL adapter can name the module it talks to instead of
 * the whole bus. Naming the whole bus is what makes a cross-module dependency
 * unresolvable: the bus aggregates every module, so requiring it inside a handler's
 * own dependency graph is a cycle through modules that never actually reference each
 * other. Per-module surfaces reduce that to the real graph, which is a DAG, and the
 * composition root's provide order is where that order is stated and checked.
 */
export class WalletCommands extends Context.Service<
  WalletCommands,
  Command.Dispatcher<typeof walletCommandGroup>
>()("@org/server/wallet/WalletCommands") {}

export const WalletCommandsLive = Layer.effect(
  WalletCommands,
  Command.dispatcher(walletCommandGroup, { spanAttributes: walletCommandSpanAttributes }),
).pipe(Layer.provide(WalletCommandHandlersLive));
