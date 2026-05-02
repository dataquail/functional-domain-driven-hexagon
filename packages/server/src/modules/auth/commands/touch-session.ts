import {
  type TouchSessionCommand,
  type TouchSessionOutput,
} from "@/modules/auth/commands/touch-session-command.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import * as Session from "@/modules/auth/domain/session.aggregate.js";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

// Sliding-TTL refresh.
//
// Throttled: skip the DB write when the prior `lastUsedAt` is younger than
// `thresholdSeconds`, so a busy SPA doesn't issue an UPDATE on every call.
// Race-tolerant: a session that vanished or was revoked between the
// middleware's find and our update is benign — `update` fails with
// SessionNotFound and we swallow it.
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const touchSession = (cmd: TouchSessionCommand): TouchSessionOutput =>
  Effect.gen(function* () {
    const repo = yield* SessionRepository;
    const session = yield* repo
      .findById(cmd.sessionId)
      .pipe(Effect.catchTag("SessionNotFound", () => Effect.succeed(null)));
    if (session?.revokedAt !== null) return;

    const now = yield* DateTime.now;
    const elapsed = DateTime.distanceDuration(session.lastUsedAt, now);
    if (Duration.lessThan(elapsed, Duration.seconds(cmd.thresholdSeconds))) return;

    const touched = Session.touch({ session, now, ttlSeconds: cmd.ttlSeconds });
    yield* repo.update(touched).pipe(Effect.catchTag("SessionNotFound", () => Effect.void));
  });
