import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SessionNotFound } from "../domain/session-errors.js";
import { type SessionId } from "../domain/session-id.js";
import { SessionRepository } from "../domain/session-repository.js";
import { type Session } from "../domain/session.aggregate.js";
import * as SessionMapper from "./session-mapper.js";

export const SessionRepositoryLive = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, session: Session) => {
      const row = SessionMapper.toPersistence(session);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO sessions
            (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
          VALUES (
            ${row.id},
            ${row.user_id},
            ${row.subject},
            ${sql.timestamp(row.expires_at)},
            ${sql.timestamp(row.absolute_expires_at)},
            ${row.revoked_at === null ? null : sql.timestamp(row.revoked_at)},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.last_used_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("SessionRepository.insert"),
      );
    });

    const findById = db.makeQuery((execute, id: SessionId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SessionRowStd)`
          SELECT * FROM sessions WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new SessionNotFound({ sessionId: id })),
        Effect.map(SessionMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("SessionRepository.findById"),
      ),
    );

    const revoke = db.makeQuery((execute, id: SessionId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SessionRowStd)`
          UPDATE sessions SET revoked_at = now()
          WHERE id = ${id} AND revoked_at IS NULL
          RETURNING *
        `),
      ).pipe(
        orFail(() => new SessionNotFound({ sessionId: id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("SessionRepository.revoke"),
      ),
    );

    const update = db.makeQuery((execute, session: Session) => {
      const row = SessionMapper.toPersistence(session);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SessionRowStd)`
          UPDATE sessions
          SET expires_at = ${sql.timestamp(row.expires_at)},
              last_used_at = ${sql.timestamp(row.last_used_at)}
          WHERE id = ${row.id} AND revoked_at IS NULL
          RETURNING *
        `),
      ).pipe(
        orFail(() => new SessionNotFound({ sessionId: session.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("SessionRepository.update"),
      );
    });

    return SessionRepository.of({ insert, findById, revoke, update });
  }),
);
