import { Module } from "@org/module";

import { RoleQueries } from "./role.query-handlers.js";

// The peer-facing surface: what another module may reach, by either route.
//
// `Module.exports` is the DI half — the Tags a peer may resolve from the
// container, which the builder checks. The re-exports below are the import half,
// for what a peer names rather than resolves; goodbones governs who may reach
// this file. Two mechanisms, one audience.
export const roleExports = Module.exports(RoleQueries);

// Auth and organization ask this module whether a caller is a super admin, and
// todos and billing ask the same question from their policy checks — all four
// through their own ACL ports. RoleCommands is deliberately absent: the bus
// routes it from the composition root, and no peer dispatches against it.
export { RoleQueries } from "./role.query-handlers.js";
