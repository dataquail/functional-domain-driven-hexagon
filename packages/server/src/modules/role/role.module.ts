import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import { RoleCommandsLive } from "./role.command-handlers.js";
import { RoleQueriesLive } from "./role.query-handlers.js";

// No inbound adapter of its own: the role module is reached only through other
// modules' ACL ports, dispatching against the surfaces below.
export const RoleModule = Module.make("role", Layer.mergeAll(RoleCommandsLive, RoleQueriesLive));
