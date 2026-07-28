import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { GrantRoleCommand } from "@/modules/role/commands/grant-role.command.js";
import { grantRoleHandler } from "@/modules/role/commands/grant-role.handler.js";
import { RevokeRoleCommand } from "@/modules/role/commands/revoke-role.command.js";
import { revokeRoleHandler } from "@/modules/role/commands/revoke-role.handler.js";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/repositories/roles.repository-live.js";

const roleCommandGroup = Command.group(GrantRoleCommand, RevokeRoleCommand);

const RoleCommandHandlersLive = Command.handlersOf(roleCommandGroup, {
  GrantRoleCommand: (payload) =>
    grantRoleHandler(payload).pipe(Effect.provide(RolesRepositoryLive)),
  RevokeRoleCommand: (payload) =>
    revokeRoleHandler(payload).pipe(Effect.provide(RolesRepositoryLive)),
});

const roleCommandSpanAttributes: Command.SpanAttributes<typeof roleCommandGroup> = {
  GrantRoleCommand: (payload) => ({
    "user.id": payload.userId,
    "role.name": payload.role,
    "actor.user.id": payload.actorUserId,
  }),
  RevokeRoleCommand: (payload) => ({ "user.id": payload.userId, "role.name": payload.role }),
};

// This module's slice of the write-side dispatch surface. See `WalletCommands` for why a
// module publishes its own surface rather than letting consumers name the bus.
export class RoleCommands extends Context.Service<
  RoleCommands,
  Command.Dispatcher<typeof roleCommandGroup>
>()("@org/server/role/RoleCommands") {}

export const RoleCommandsLive = Layer.effect(
  RoleCommands,
  Command.dispatcher(roleCommandGroup, { spanAttributes: roleCommandSpanAttributes }),
).pipe(Layer.provide(RoleCommandHandlersLive));
