import { Database, RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.ts";
import {
  type FindSessionPayload,
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
  type SessionView,
} from "@/modules/auth/queries/find-session.query.ts";

// Looks up a session by id and validates its lifecycle (revoked /
// expired). Used by the auth middleware via `QueryBus.execute(...)` —
// the bus-boundary span (ADR-0012) wraps this at dispatch time.
export const findSessionHandler = Effect.fn("findSessionHandler")(function* (
  query: FindSessionPayload,
) {
  const sql = yield* Database.Database;

  const found = yield* sql`
    SELECT * FROM auth.sessions WHERE id = ${query.sessionId}
  `.pipe(Database.maybeRow(RowSchemas.SessionRow), translateDatabaseErrors);

  if (Option.isNone(found)) {
    return yield* new SessionNotFound({ sessionId: query.sessionId });
  }

  const row = found.value;

  if (Option.isSome(Option.fromNullOr(row.revoked_at))) {
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
