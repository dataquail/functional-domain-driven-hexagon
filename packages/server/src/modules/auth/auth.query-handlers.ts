import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";

import { type PlatformRoles } from "@/modules/auth/domain/ports/acl/platform-roles.acl.js";
import { findApiTokenByHash } from "@/modules/auth/queries/find-api-token-by-hash.handler.js";
import {
  type ApiTokenExpired,
  type ApiTokenNotFound,
  type ApiTokenPrincipalView,
  type ApiTokenRevoked,
  type FindApiTokenByHashQuery,
  findApiTokenByHashQuerySpanAttributes,
} from "@/modules/auth/queries/find-api-token-by-hash.query.js";
import { findCurrentUser } from "@/modules/auth/queries/find-current-user.handler.js";
import {
  type CurrentUserView,
  type FindCurrentUserQuery,
  findCurrentUserQuerySpanAttributes,
} from "@/modules/auth/queries/find-current-user.query.js";
import { findSession } from "@/modules/auth/queries/find-session.handler.js";
import {
  type FindSessionQuery,
  findSessionQuerySpanAttributes,
  type SessionExpired,
  type SessionNotFound,
  type SessionRevoked,
  type SessionView,
} from "@/modules/auth/queries/find-session.query.js";
import { listMyApiTokens } from "@/modules/auth/queries/list-my-api-tokens.handler.js";
import {
  type ApiTokenView,
  type ListMyApiTokensQuery,
  listMyApiTokensQuerySpanAttributes,
} from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindSessionOutput = Effect.Effect<
  SessionView,
  SessionNotFound | SessionExpired | SessionRevoked | PersistenceUnavailable,
  Database.Database
>;

type FindApiTokenByHashOutput = Effect.Effect<
  ApiTokenPrincipalView,
  ApiTokenNotFound | ApiTokenExpired | ApiTokenRevoked | PersistenceUnavailable,
  Database.Database
>;

type ListMyApiTokensOutput = Effect.Effect<
  ReadonlyArray<ApiTokenView>,
  PersistenceUnavailable,
  Database.Database
>;

// `PlatformRoles` stays in the output R rather than being wrapped here: the
// adapter dispatches through the QueryBus, so closing it inside the query-bus
// layer would make that layer depend on itself. The composition root provides it
// where the endpoint call sites can see it.
type FindCurrentUserOutput = Effect.Effect<CurrentUserView, PersistenceUnavailable, PlatformRoles>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindSessionQuery: {
      readonly query: FindSessionQuery;
      readonly output: FindSessionOutput;
    };
    FindApiTokenByHashQuery: {
      readonly query: FindApiTokenByHashQuery;
      readonly output: FindApiTokenByHashOutput;
    };
    ListMyApiTokensQuery: {
      readonly query: ListMyApiTokensQuery;
      readonly output: ListMyApiTokensOutput;
    };
    FindCurrentUserQuery: {
      readonly query: FindCurrentUserQuery;
      readonly output: FindCurrentUserOutput;
    };
  }
}

export const authQueryHandlers = queryHandlers({
  FindSessionQuery: {
    handle: findSession,
    spanAttributes: findSessionQuerySpanAttributes,
  },
  FindApiTokenByHashQuery: {
    handle: findApiTokenByHash,
    spanAttributes: findApiTokenByHashQuerySpanAttributes,
  },
  ListMyApiTokensQuery: {
    handle: listMyApiTokens,
    spanAttributes: listMyApiTokensQuerySpanAttributes,
  },
  FindCurrentUserQuery: {
    handle: findCurrentUser,
    spanAttributes: findCurrentUserQuerySpanAttributes,
  },
});
