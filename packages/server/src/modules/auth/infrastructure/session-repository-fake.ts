import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { SessionNotFound } from "../domain/session-errors.js";
import { type SessionId } from "../domain/session-id.js";
import { SessionRepository } from "../domain/session-repository.js";
import { Session } from "../domain/session.aggregate.js";

export const SessionRepositoryFake = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<SessionId, Session>());

    const insert = (session: Session): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(session.id, session));

    const findById = (id: SessionId): Effect.Effect<Session, SessionNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new SessionNotFound({ sessionId: id })),
          onSome: Effect.succeed,
        }),
      );

    // Mirrors the live impl: an already-revoked session is reported as
    // SessionNotFound (the SQL UPDATE matches `WHERE revoked_at IS NULL`,
    // so a re-revoke returns zero rows and `orFail` raises NotFound).
    const revoke = (id: SessionId): Effect.Effect<void, SessionNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        const existing = HashMap.get(m, id);
        if (Option.isNone(existing) || existing.value.revokedAt !== null) {
          return yield* Effect.fail(new SessionNotFound({ sessionId: id }));
        }
        const now = yield* DateTime.now;
        yield* Ref.update(store, (m2) =>
          HashMap.set(
            m2,
            id,
            Session.make({
              id: existing.value.id,
              userId: existing.value.userId,
              subject: existing.value.subject,
              expiresAt: existing.value.expiresAt,
              absoluteExpiresAt: existing.value.absoluteExpiresAt,
              revokedAt: now,
              createdAt: existing.value.createdAt,
              lastUsedAt: existing.value.lastUsedAt,
            }),
          ),
        );
      });

    // Mirrors the live impl: only updates rows where revoked_at IS NULL.
    // A revoked or missing row fails SessionNotFound — callers on the touch
    // path catch and ignore (benign race).
    const update = (session: Session): Effect.Effect<void, SessionNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        const existing = HashMap.get(m, session.id);
        if (Option.isNone(existing) || existing.value.revokedAt !== null) {
          return yield* Effect.fail(new SessionNotFound({ sessionId: session.id }));
        }
        yield* Ref.update(store, (m2) =>
          HashMap.set(
            m2,
            session.id,
            Session.make({
              id: existing.value.id,
              userId: existing.value.userId,
              subject: existing.value.subject,
              expiresAt: session.expiresAt,
              absoluteExpiresAt: existing.value.absoluteExpiresAt,
              revokedAt: existing.value.revokedAt,
              createdAt: existing.value.createdAt,
              lastUsedAt: session.lastUsedAt,
            }),
          ),
        );
      });

    return SessionRepository.of({ insert, findById, revoke, update });
  }),
);
