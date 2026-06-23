import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { type ApiToken } from "@/modules/auth/domain/api-token.aggregate.js";
import {
  type ApiTokenExpired,
  type ApiTokenNotFound,
  type ApiTokenRevoked,
} from "@/modules/auth/domain/api-token-errors.js";
import { type Session } from "@/modules/auth/domain/session.aggregate.js";
import {
  type SessionExpired,
  type SessionNotFound,
  type SessionRevoked,
} from "@/modules/auth/domain/session-errors.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/api-token-repository-live.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/session-repository-live.js";
import { findApiTokenByHash } from "@/modules/auth/queries/find-api-token-by-hash.js";
import {
  type FindApiTokenByHashQuery,
  findApiTokenByHashQuerySpanAttributes,
} from "@/modules/auth/queries/find-api-token-by-hash-query.js";
import { findSession } from "@/modules/auth/queries/find-session.js";
import {
  type FindSessionQuery,
  findSessionQuerySpanAttributes,
} from "@/modules/auth/queries/find-session-query.js";
import { listMyApiTokens } from "@/modules/auth/queries/list-my-api-tokens.js";
import {
  type ListMyApiTokensQuery,
  listMyApiTokensQuerySpanAttributes,
} from "@/modules/auth/queries/list-my-api-tokens-query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindSessionBusOutput = Effect.Effect<
  Session,
  SessionNotFound | SessionExpired | SessionRevoked | PersistenceUnavailable,
  Database.Database
>;

type FindApiTokenByHashBusOutput = Effect.Effect<
  ApiToken,
  ApiTokenNotFound | ApiTokenExpired | ApiTokenRevoked | PersistenceUnavailable,
  Database.Database
>;

type ListMyApiTokensBusOutput = Effect.Effect<
  ReadonlyArray<ApiToken>,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindSessionQuery: {
      readonly query: FindSessionQuery;
      readonly output: FindSessionBusOutput;
    };
    FindApiTokenByHashQuery: {
      readonly query: FindApiTokenByHashQuery;
      readonly output: FindApiTokenByHashBusOutput;
    };
    ListMyApiTokensQuery: {
      readonly query: ListMyApiTokensQuery;
      readonly output: ListMyApiTokensBusOutput;
    };
  }
}

export const authQueryHandlers = queryHandlers({
  FindSessionQuery: {
    handle: (q): FindSessionBusOutput => findSession(q).pipe(Effect.provide(SessionRepositoryLive)),
    spanAttributes: findSessionQuerySpanAttributes,
  },
  FindApiTokenByHashQuery: {
    handle: (q): FindApiTokenByHashBusOutput =>
      findApiTokenByHash(q).pipe(Effect.provide(ApiTokenRepositoryLive)),
    spanAttributes: findApiTokenByHashQuerySpanAttributes,
  },
  ListMyApiTokensQuery: {
    handle: (q): ListMyApiTokensBusOutput =>
      listMyApiTokens(q).pipe(Effect.provide(ApiTokenRepositoryLive)),
    spanAttributes: listMyApiTokensQuerySpanAttributes,
  },
});
