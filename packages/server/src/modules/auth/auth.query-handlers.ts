import { Query } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { PlatformRolesLive } from "@/modules/auth/infrastructure/acl/platform-roles.acl-live.js";
import { findApiTokenByHash } from "@/modules/auth/queries/find-api-token-by-hash.handler.js";
import { FindApiTokenByHash } from "@/modules/auth/queries/find-api-token-by-hash.query.js";
import { findCurrentUser } from "@/modules/auth/queries/find-current-user.handler.js";
import { FindCurrentUser } from "@/modules/auth/queries/find-current-user.query.js";
import { findSession } from "@/modules/auth/queries/find-session.handler.js";
import { FindSession } from "@/modules/auth/queries/find-session.query.js";
import { listMyApiTokens } from "@/modules/auth/queries/list-my-api-tokens.handler.js";
import { ListMyApiTokens } from "@/modules/auth/queries/list-my-api-tokens.query.js";

// This module's slice of the read-side dispatch surface. `handlersOf` is what lets the
// `PlatformRoles` adapter be provided here: the role-module requirement it drags in is
// inferred onto this layer rather than written into a type, so auth never names a role
// type.
const authQueryGroup = Query.group(
  FindCurrentUser,
  FindSession,
  FindApiTokenByHash,
  ListMyApiTokens,
);

const AuthQueryHandlersLive = Query.handlersOf(authQueryGroup, {
  FindCurrentUserQuery: (payload) => findCurrentUser(payload),
  FindSessionQuery: (payload) => findSession(payload),
  FindApiTokenByHashQuery: (payload) => findApiTokenByHash(payload),
  ListMyApiTokensQuery: (payload) => listMyApiTokens(payload),
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
