import { grantRole } from "@/modules/role/commands/grant-role.js";
import { grantRoleCommandSpanAttributes } from "@/modules/role/commands/grant-role-command.js";
import { revokeRole } from "@/modules/role/commands/revoke-role.js";
import { revokeRoleCommandSpanAttributes } from "@/modules/role/commands/revoke-role-command.js";
import { commandHandlers } from "@/platform/ddd/command-bus.js";

export const roleCommandHandlers = commandHandlers({
  GrantRoleCommand: { handle: grantRole, spanAttributes: grantRoleCommandSpanAttributes },
  RevokeRoleCommand: { handle: revokeRole, spanAttributes: revokeRoleCommandSpanAttributes },
});
