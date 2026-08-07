import { Query } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { findUsersHandler } from "@/modules/user/queries/find-users.handler.js";
import { FindUsersQuery } from "@/modules/user/queries/find-users.query.js";
import { findUsersByIdsHandler } from "@/modules/user/queries/find-users-by-ids.handler.js";
import { FindUsersByIdsQuery } from "@/modules/user/queries/find-users-by-ids.query.js";

// `FindUsersQuery` is dispatched by an HTTP endpoint through the app-wide bus.
// `FindUsersByIdsQuery`'s only consumer is the organization module's `UsersLookup`
// adapter, which resolves this surface directly through its own port (ADR-0022) rather
// than going through the bus.
export const userQueryGroup = Query.group(FindUsersQuery, FindUsersByIdsQuery);

const UserQueryHandlersLive = Query.handlersOf(userQueryGroup, {
  FindUsersQuery: (payload) => findUsersHandler(payload),
  FindUsersByIdsQuery: (payload) => findUsersByIdsHandler(payload),
});

// A batch's size is useful for spotting a runaway fan-out; the ids themselves are not
// span-safe.
const userQuerySpanAttributes: Query.SpanAttributes<typeof userQueryGroup> = {
  FindUsersQuery: (payload) => ({
    "query.page": payload.page,
    "query.pageSize": payload.pageSize,
  }),
  FindUsersByIdsQuery: (payload) => ({ "query.id.count": payload.ids.length }),
};

// This module's slice of the read-side dispatch surface. See `UserCommands` for why a
// module publishes its own surface rather than letting consumers name the bus.
export class UserQueries extends Context.Service<
  UserQueries,
  Query.Dispatcher<typeof userQueryGroup>
>()("@org/server/user/UserQueries") {}

export const UserQueriesLive = Layer.effect(
  UserQueries,
  Query.dispatcher(userQueryGroup, { spanAttributes: userQuerySpanAttributes }),
).pipe(Layer.provide(UserQueryHandlersLive));
