import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { type TouchSessionCommand } from "@/modules/auth/commands/touch-session.command.js";
import { SessionRepository } from "@/modules/auth/domain/ports/repositories/session.repository.js";
import { SessionRootOps } from "@/modules/auth/domain/session.root.js";

// Sliding-TTL refresh.
//
// Throttled: skip the DB write when the prior `lastUsedAt` is younger than
// `thresholdSeconds`, so a busy SPA doesn't issue an UPDATE on every call.
// Race-tolerant: a session that vanished or was revoked between the
// middleware's find and our update is benign — `update` fails with
// SessionNotFound and we swallow it.
//
// Transient-DB-tolerant: this runs in middleware on every request. If the
// DB is unavailable for the sliding-write, we'd rather let the surrounding
// request continue (auth was already verified by FindSessionQuery) than
// 503 a request that would otherwise succeed. The user's session TTL
// just doesn't extend this round — they get refreshed on the next request.
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const touchSession = Effect.fn("touchSession")(function* (cmd: TouchSessionCommand) {
  const repo = yield* SessionRepository;
  const session = yield* repo.findOneById(cmd.sessionId).pipe(
    Effect.catchTag("SessionNotFound", () => Effect.succeed(null)),
    Effect.catchTag("PersistenceUnavailable", () => Effect.succeed(null)),
  );
  if (session?.revokedAt !== null) return;

  const now = yield* DateTime.now;
  const elapsed = DateTime.distance(session.lastUsedAt, now);
  if (Duration.isLessThan(elapsed, Duration.seconds(cmd.thresholdSeconds))) return;

  const touched = SessionRootOps.touch({ session, now, ttlSeconds: cmd.ttlSeconds });
  yield* repo.updateOne(touched).pipe(
    Effect.catchTag("SessionNotFound", () => Effect.void),
    Effect.catchTag("PersistenceUnavailable", () => Effect.void),
  );
});
