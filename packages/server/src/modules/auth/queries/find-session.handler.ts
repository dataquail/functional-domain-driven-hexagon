import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { SessionRepository } from "@/modules/auth/domain/ports/repositories/session.repository.js";
import { SessionExpired, SessionRevoked } from "@/modules/auth/domain/session.errors.js";
import { type FindSessionQuery } from "@/modules/auth/queries/find-session.query.js";

// Looks up a session and validates its lifecycle (revoked / expired). Used
// by the auth middleware via `QueryBus.execute(FindSessionQuery.make({...}))`
// — the bus-boundary span (ADR-0012) wraps this at dispatch time.
export const findSession = Effect.fn("findSession")(function* (query: FindSessionQuery) {
  const sessions = yield* SessionRepository;
  const session = yield* sessions.findOneById(query.sessionId);
  if (session.revokedAt !== null) {
    return yield* new SessionRevoked({ sessionId: query.sessionId });
  }
  const now = yield* DateTime.now;
  if (DateTime.isLessThanOrEqualTo(session.expiresAt, now)) {
    return yield* new SessionExpired({ sessionId: query.sessionId });
  }
  if (DateTime.isLessThanOrEqualTo(session.absoluteExpiresAt, now)) {
    return yield* new SessionExpired({ sessionId: query.sessionId });
  }
  return session;
});
