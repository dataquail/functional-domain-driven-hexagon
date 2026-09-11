import { type Query } from "@effect-server-utils/cqrs";
import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import { RoleCommandsLive } from "./role.command-handlers.js";
import { type rolePeerQueries } from "./role.exports.js";
import { RoleQueriesLive } from "./role.query-handlers.js";

// No inbound adapter of its own: the role module is reached only through other
// modules' ACL ports. The type argument is the whole of what a peer may resolve
// — the subset declared in role.exports.ts — and the builder refuses any module
// that reaches for a registration wider than it.
export const RoleModule = Module.make<Query.Registered<typeof rolePeerQueries>>()(
  "role",
  Layer.mergeAll(RoleCommandsLive, RoleQueriesLive),
);
