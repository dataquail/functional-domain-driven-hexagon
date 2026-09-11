import { Module } from "@org/module";

import { RoleQueries } from "./role.query-handlers.js";

// What another module may resolve from the container. Auth and organization both
// ask this module whether a caller is a super admin, through their own ACL ports.
// RoleCommands is deliberately absent: the bus routes it from the composition
// root, and no peer module dispatches against it.
export const roleExports = Module.exports(RoleQueries);
