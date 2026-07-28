import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { GrantRole } from "@/modules/role/commands/grant-role.command.js";
import { grantRole } from "@/modules/role/commands/grant-role.handler.js";
import { RevokeRole } from "@/modules/role/commands/revoke-role.command.js";
import { revokeRole } from "@/modules/role/commands/revoke-role.handler.js";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/repositories/roles.repository-live.js";

const roleCommandGroup = Command.group(GrantRole, RevokeRole);

const RoleCommandHandlersLive = Command.handlersOf(roleCommandGroup, {
  GrantRoleCommand: (payload) => grantRole(payload).pipe(Effect.provide(RolesRepositoryLive)),
  RevokeRoleCommand: (payload) => revokeRole(payload).pipe(Effect.provide(RolesRepositoryLive)),
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
