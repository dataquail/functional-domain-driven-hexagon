import { Database, RowSchemas, sql } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type FindSessionQuery,
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
  type SessionView,
} from "@/modules/auth/queries/find-session.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Looks up a session by id and validates its lifecycle (revoked /
// expired). Used by the auth middleware via `QueryBus.execute(...)` —
// the bus-boundary span (ADR-0012) wraps this at dispatch time.
export const findSession = Effect.fn("findSession")(function* (query: FindSessionQuery) {
  const db = yield* Database.Database;
  const row = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SessionRowStd)`
          SELECT * FROM auth.sessions WHERE id = ${query.sessionId}
        `),
      ),
    )()
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );
  if (row === null) {
    return yield* new SessionNotFound({ sessionId: query.sessionId });
  }
  if (row.revoked_at !== null) {
    return yield* new SessionRevoked({ sessionId: query.sessionId });
  }
  const now = yield* DateTime.now;
  if (DateTime.isLessThanOrEqualTo(row.expires_at, now)) {
    return yield* new SessionExpired({ sessionId: query.sessionId });
  }
  if (DateTime.isLessThanOrEqualTo(row.absolute_expires_at, now)) {
    return yield* new SessionExpired({ sessionId: query.sessionId });
  }
  const view: SessionView = { id: query.sessionId, userId: UserId.make(row.user_id) };
  return view;
});
