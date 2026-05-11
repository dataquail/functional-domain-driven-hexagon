import { FakeDatabaseRelaxedLive, FakeDatabaseTag } from "@/test-utils/fake-database.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SessionNotFound } from "../domain/session-errors.js";
import { type SessionId } from "../domain/session-id.js";
import { SessionRepository } from "../domain/session-repository.js";
import { Session } from "../domain/session.aggregate.js";

// Shared-state variant. See user-repository-fake.ts header.
export const SessionRepositoryFakeShared: Layer.Layer<SessionRepository, never, FakeDatabaseTag> =
  Layer.effect(
    SessionRepository,
    Effect.gen(function* () {
      const db = yield* FakeDatabaseTag;

      const insert = (session: Session) =>
        db.insertSession(session).pipe(
          // ON DELETE CASCADE from users → sessions guarantees we
          // never insert a session whose user vanished. A missing
          // user here is an architectural bug; die rather than
          // fabricate a domain error.
          Effect.catchTag("ForeignKeyViolation", (e) => Effect.die(e)),
        );

      const findById = (id: SessionId) => {
        const session = db.sessions.get(id);
        return session === undefined
          ? Effect.fail(new SessionNotFound({ sessionId: id }))
          : Effect.succeed(session);
      };

      // Mirrors the live impl: an already-revoked session is reported
      // as SessionNotFound (the SQL UPDATE matches `WHERE revoked_at
      // IS NULL`, so a re-revoke returns zero rows and `orFail` raises
      // NotFound).
      const revoke = (id: SessionId): Effect.Effect<void, SessionNotFound> =>
        Effect.gen(function* () {
          const existing = db.sessions.get(id);
          if (existing?.revokedAt !== null) {
            return yield* Effect.fail(new SessionNotFound({ sessionId: id }));
          }
          const now = yield* DateTime.now;
          db.sessions.set(
            id,
            Session.make({
              id: existing.id,
              userId: existing.userId,
              subject: existing.subject,
              expiresAt: existing.expiresAt,
              absoluteExpiresAt: existing.absoluteExpiresAt,
              revokedAt: now,
              createdAt: existing.createdAt,
              lastUsedAt: existing.lastUsedAt,
            }),
          );
        });

      // Mirrors the live impl: only updates rows where revoked_at IS
      // NULL. A revoked or missing row fails SessionNotFound — callers
      // on the touch path catch and ignore (benign race).
      const update = (session: Session): Effect.Effect<void, SessionNotFound> =>
        Effect.gen(function* () {
          const existing = db.sessions.get(session.id);
          if (existing?.revokedAt !== null) {
            return yield* Effect.fail(new SessionNotFound({ sessionId: session.id }));
          }
          db.sessions.set(
            session.id,
            Session.make({
              id: existing.id,
              userId: existing.userId,
              subject: existing.subject,
              expiresAt: session.expiresAt,
              absoluteExpiresAt: existing.absoluteExpiresAt,
              revokedAt: existing.revokedAt,
              createdAt: existing.createdAt,
              lastUsedAt: session.lastUsedAt,
            }),
          );
        });

      return SessionRepository.of({ insert, findById, revoke, update });
    }),
  );

export const SessionRepositoryFake = SessionRepositoryFakeShared.pipe(
  Layer.provide(FakeDatabaseRelaxedLive),
);
