// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is role.exports.ts — `RoleQueries` lives there,
// not here, because its consumers are other modules' ACL adapters.
export { roleCommandGroup, RoleCommands } from "./role.command-handlers.js";
export { roleEventSpanAttributes } from "./role.event-span-attributes.js";
export { RoleLayer } from "./role.module.js";
// RoleQueriesLive is published because a cross-module integration test stages
// this read surface alone, without the write side the whole module would drag in.
export { RoleQueriesLive } from "./role.query-handlers.js";
