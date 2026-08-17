import { Query } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { findUserRolesHandler } from "@/modules/role/queries/find-user-roles.handler.js";
import { FindUserRolesQuery } from "@/modules/role/queries/find-user-roles.policy-query.js";

// This is a policy-query, so its only consumers are other modules' ACL adapters, and
// ADR-0022 has them reach it through their own port. They resolve this surface directly;
// nothing dispatches the tag on the app-wide bus.
export const roleQueryGroup = Query.group(FindUserRolesQuery);

const RoleQueryHandlersLive = Query.handlersOf(roleQueryGroup, {
  FindUserRolesQuery: (payload) => findUserRolesHandler(payload),
});

const roleQuerySpanAttributes: Query.SpanAttributes<typeof roleQueryGroup> = {
  FindUserRolesQuery: (payload) => ({ "query.userId": payload.userId }),
};

// This module's slice of the read-side dispatch surface, and the one four other
// modules resolve: each owns a `PlatformRoles` port whose adapter asks this question.
// Those adapters name this surface rather than the bus, which is what keeps the
// modules whose handlers depend on them out of a cycle with the bus that routes them.
export class RoleQueries extends Context.Service<
  RoleQueries,
  Query.Dispatcher<typeof roleQueryGroup>
>()("@org/server/role/RoleQueries") {}

export const RoleQueriesLive = Layer.effect(
  RoleQueries,
  Query.dispatcher(roleQueryGroup, { spanAttributes: roleQuerySpanAttributes }),
).pipe(Layer.provide(RoleQueryHandlersLive));
