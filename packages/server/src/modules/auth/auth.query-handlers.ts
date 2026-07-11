import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import {
  type ApiTokenExpired,
  type ApiTokenNotFound,
  type ApiTokenRevoked,
} from "@/modules/auth/domain/api-token/api-token.errors.js";
import { type ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import {
  type SessionExpired,
  type SessionNotFound,
  type SessionRevoked,
} from "@/modules/auth/domain/session/session.errors.js";
import { type SessionRoot } from "@/modules/auth/domain/session/session.root.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/repositories/session.repository-live.js";
import { findApiTokenByHash } from "@/modules/auth/queries/find-api-token-by-hash.handler.js";
import {
  type FindApiTokenByHashQuery,
  findApiTokenByHashQuerySpanAttributes,
} from "@/modules/auth/queries/find-api-token-by-hash.query.js";
import { findSession } from "@/modules/auth/queries/find-session.handler.js";
import {
  type FindSessionQuery,
  findSessionQuerySpanAttributes,
} from "@/modules/auth/queries/find-session.query.js";
import { listMyApiTokens } from "@/modules/auth/queries/list-my-api-tokens.handler.js";
import {
  type ListMyApiTokensQuery,
  listMyApiTokensQuerySpanAttributes,
} from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindSessionOutput = Effect.Effect<
  SessionRoot,
  SessionNotFound | SessionExpired | SessionRevoked | PersistenceUnavailable,
  Database.Database
>;

type FindApiTokenByHashOutput = Effect.Effect<
  ApiTokenRoot,
  ApiTokenNotFound | ApiTokenExpired | ApiTokenRevoked | PersistenceUnavailable,
  Database.Database
>;

type ListMyApiTokensOutput = Effect.Effect<
  ReadonlyArray<ApiTokenRoot>,
  PersistenceUnavailable,
  Database.Database
>;

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
  }
}

export const authQueryHandlers = queryHandlers({
  FindSessionQuery: {
    handle: (q): FindSessionOutput => findSession(q).pipe(Effect.provide(SessionRepositoryLive)),
    spanAttributes: findSessionQuerySpanAttributes,
  },
  FindApiTokenByHashQuery: {
    handle: (q): FindApiTokenByHashOutput =>
      findApiTokenByHash(q).pipe(Effect.provide(ApiTokenRepositoryLive)),
    spanAttributes: findApiTokenByHashQuerySpanAttributes,
  },
  ListMyApiTokensQuery: {
    handle: (q): ListMyApiTokensOutput =>
      listMyApiTokens(q).pipe(Effect.provide(ApiTokenRepositoryLive)),
    spanAttributes: listMyApiTokensQuerySpanAttributes,
  },
});
