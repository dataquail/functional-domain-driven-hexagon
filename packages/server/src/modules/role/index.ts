export { GrantRoleCommand } from "./commands/grant-role.command.js";
export { RevokeRoleCommand } from "./commands/revoke-role.command.js";
export { CannotPromoteSelf } from "./domain/roles/role.errors.js";
export { RoleGranted, RoleRevoked } from "./domain/roles/role.events.js";
export { RoleValueObject } from "./domain/roles/role.value-object.js";
export { roleCommandGroup, RoleCommands } from "./role.command-handlers.js";
export { roleEventSpanAttributes } from "./role.event-span-attributes.js";
export { RoleModule } from "./role.module.js";
// RoleQueriesLive is published beside the module because a cross-module
// integration test stages this read surface alone, without the write side the
// whole module would drag in.
export { RoleQueries, RoleQueriesLive, roleQueryGroup } from "./role.query-handlers.js";
