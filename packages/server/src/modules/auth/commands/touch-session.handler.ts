import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { type TouchSessionPayload } from "@/modules/auth/commands/touch-session.command.ts";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.ts";
import { SessionRootOps } from "@/modules/auth/domain/session/session.root-ops.ts";
import { SessionSpecifications } from "@/modules/auth/domain/session/session.specification.ts";

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
export const touchSessionHandler = Effect.fn("touchSessionHandler")(function* (
  cmd: TouchSessionPayload,
) {
  const repo = yield* SessionRepository;

  const found = yield* repo.findOne(SessionSpecifications.withId(cmd.sessionId)).pipe(
    Effect.map(Option.filter((candidate) => Option.isNone(candidate.revokedAt))),
    Effect.catchTag("PersistenceUnavailable", () => Effect.succeedNone),
  );

  if (Option.isNone(found)) return;

  const session = found.value;

  const now = yield* DateTime.now;
  const elapsed = DateTime.distance(session.lastUsedAt, now);

  if (Duration.isLessThan(elapsed, Duration.seconds(cmd.thresholdSeconds))) return;

  const touched = SessionRootOps.touch({ session, now, ttlSeconds: cmd.ttlSeconds });
  yield* repo.updateOne(touched).pipe(
    Effect.catchTags({
      SessionNotFound: () => Effect.void,
      PersistenceUnavailable: () => Effect.void,
    }),
  );
});
