import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { type Session } from "@/modules/auth/domain/session.aggregate.js";
import {
  type SessionExpired,
  type SessionNotFound,
  type SessionRevoked,
} from "@/modules/auth/domain/session-errors.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/session-repository-live.js";
import { findSession } from "@/modules/auth/queries/find-session.js";
import {
  type FindSessionQuery,
  findSessionQuerySpanAttributes,
} from "@/modules/auth/queries/find-session-query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindSessionBusOutput = Effect.Effect<
  Session,
  SessionNotFound | SessionExpired | SessionRevoked | PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindSessionQuery: {
      readonly query: FindSessionQuery;
      readonly output: FindSessionBusOutput;
    };
  }
}

export const authQueryHandlers = queryHandlers({
  FindSessionQuery: {
    handle: (q): FindSessionBusOutput => findSession(q).pipe(Effect.provide(SessionRepositoryLive)),
    spanAttributes: findSessionQuerySpanAttributes,
  },
});
