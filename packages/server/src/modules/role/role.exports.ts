import { type Query } from "@effect-server-utils/cqrs";
import { Module } from "@org/module";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { RoleQueries, type roleQueryGroup } from "./role.query-handlers.js";

// The peer surface: the individual messages other modules may dispatch, named
// one by one. The `Pick` list is the whole of it, so adding a query to
// `roleQueryGroup` cannot widen what peers may reach — which handing out
// `RoleQueries` itself would.
//
// A projection of the module's own dispatch surface, not a second registration:
// a dispatcher is one method per tag, so this picks methods off the real one and
// the handlers stay registered once.
export class RoleExports extends Context.Service<
  RoleExports,
  Pick<Query.Dispatcher<typeof roleQueryGroup>, "FindUserRolesQuery">
>()("@org/server/role/RoleExports") {}

export const RoleExportsLive = Layer.effect(
  RoleExports,
  Effect.map(RoleQueries, (queries) =>
    RoleExports.of({ FindUserRolesQuery: queries.FindUserRolesQuery }),
  ),
);

// Auth, organization, todos and billing each ask whether a caller holds a role,
// through their own ACL ports.
export const roleExports = Module.exports(RoleExports);
