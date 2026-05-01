import { SessionExpired, SessionRevoked } from "@/modules/auth/domain/session-errors.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import {
  type FindSessionOutput,
  type FindSessionQuery,
} from "@/modules/auth/queries/find-session-query.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

// Looks up a session and validates its lifecycle (revoked / expired). Used
// by the auth middleware via `QueryBus.execute(FindSessionQuery.make({...}))`
// — the bus-boundary span (ADR-0012) wraps this at dispatch time.
export const findSession = (query: FindSessionQuery): FindSessionOutput =>
  Effect.gen(function* () {
    const sessions = yield* SessionRepository;
    const session = yield* sessions.findById(query.sessionId);
    if (session.revokedAt !== null) {
      return yield* Effect.fail(new SessionRevoked({ sessionId: query.sessionId }));
    }
    const now = yield* DateTime.now;
    if (DateTime.lessThanOrEqualTo(session.expiresAt, now)) {
      return yield* Effect.fail(new SessionExpired({ sessionId: query.sessionId }));
    }
    if (DateTime.lessThanOrEqualTo(session.absoluteExpiresAt, now)) {
      return yield* Effect.fail(new SessionExpired({ sessionId: query.sessionId }));
    }
    return session;
  });
