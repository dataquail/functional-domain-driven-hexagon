import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import { RoleCommandsLive } from "./role.command-handlers.js";
import { roleExports } from "./role.exports.js";
import { RoleQueriesLive } from "./role.query-handlers.js";

// No inbound adapter of its own: the role module is reached only through other
// modules' ACL ports. Only the read side is published — RoleCommands is routed by
// the bus at the composition root and is not a peer module's to resolve.
export const RoleModule = Module.make("role", Layer.mergeAll(RoleCommandsLive, RoleQueriesLive), {
  exports: roleExports,
});
