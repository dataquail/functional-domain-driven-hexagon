export { GrantRole } from "./commands/grant-role.command.js";
export { RevokeRole } from "./commands/revoke-role.command.js";
export { CannotPromoteSelf } from "./domain/roles/role.errors.js";
export { RoleGranted, RoleRevoked } from "./domain/roles/role.events.js";
export { RoleValueObject } from "./domain/roles/role.value-object.js";
export { RoleCommands, RoleCommandsLive } from "./role.command-handlers.js";
export { roleEventSpanAttributes } from "./role.event-span-attributes.js";
export { RoleQueries, RoleQueriesLive } from "./role.query-handlers.js";
