import { Query } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { PlatformRolesLive } from "@/modules/auth/infrastructure/acl/platform-roles.acl-live.js";
import { findApiTokenByHashHandler } from "@/modules/auth/queries/find-api-token-by-hash.handler.js";
import { FindApiTokenByHashQuery } from "@/modules/auth/queries/find-api-token-by-hash.query.js";
import { findCurrentUserHandler } from "@/modules/auth/queries/find-current-user.handler.js";
import { FindCurrentUserQuery } from "@/modules/auth/queries/find-current-user.query.js";
import { findSessionHandler } from "@/modules/auth/queries/find-session.handler.js";
import { FindSessionQuery } from "@/modules/auth/queries/find-session.query.js";
import { listMyApiTokensHandler } from "@/modules/auth/queries/list-my-api-tokens.handler.js";
import { ListMyApiTokensQuery } from "@/modules/auth/queries/list-my-api-tokens.query.js";

// This module's slice of the read-side dispatch surface. `handlersOf` is what lets the
// `PlatformRoles` adapter be provided here: the role-module requirement it drags in is
// inferred onto this layer rather than written into a type, so auth never names a role
// type.
export const authQueryGroup = Query.group(
  FindCurrentUserQuery,
  FindSessionQuery,
  FindApiTokenByHashQuery,
  ListMyApiTokensQuery,
);

const AuthQueryHandlersLive = Query.handlersOf(authQueryGroup, {
  FindCurrentUserQuery: (payload) => findCurrentUserHandler(payload),
  FindSessionQuery: (payload) => findSessionHandler(payload),
  FindApiTokenByHashQuery: (payload) => findApiTokenByHashHandler(payload),
  ListMyApiTokensQuery: (payload) => listMyApiTokensHandler(payload),
}).pipe(Layer.provide(PlatformRolesLive));

// `tokenHash` is secret-derived and never reaches a span; a session id is an opaque
// UUID and does.
const authQuerySpanAttributes: Query.SpanAttributes<typeof authQueryGroup> = {
  FindCurrentUserQuery: (payload) => ({ "user.id": payload.userId }),
  FindSessionQuery: (payload) => ({ "auth.session.id": payload.sessionId }),
  ListMyApiTokensQuery: (payload) => ({ "user.id": payload.userId }),
};

export class AuthQueries extends Context.Service<
  AuthQueries,
  Query.Dispatcher<typeof authQueryGroup>
>()("@org/server/auth/AuthQueries") {}

export const AuthQueriesLive = Layer.effect(
  AuthQueries,
  Query.dispatcher(authQueryGroup, { spanAttributes: authQuerySpanAttributes }),
).pipe(Layer.provide(AuthQueryHandlersLive));
