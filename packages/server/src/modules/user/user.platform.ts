// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is user.exports.ts. `UserCommands` and
// `UserQueries` appear in both: the buses route them, and auth and organization
// resolve them through their own ACL ports.
export { userCommandGroup, UserCommands } from "./user.command-handlers";
export { userEventSpanAttributes } from "./user.event-span-attributes";
export { UserModule } from "./user.module";
export { UserQueries, userQueryGroup } from "./user.query-handlers";
