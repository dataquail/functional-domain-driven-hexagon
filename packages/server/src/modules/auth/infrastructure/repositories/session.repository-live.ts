import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SessionNotFound } from "@/modules/auth/domain/session/session.errors.js";
import { type SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import { type SessionRoot } from "@/modules/auth/domain/session/session.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as SessionMapper from "./session.mapper.js";

export const SessionRepositoryLive = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, session: SessionRoot) => {
      const row = SessionMapper.toPersistence(session);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO auth.sessions
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
        translatePersistenceUnavailable,
        Effect.withSpan("SessionRepository.insertOne"),
      );
    });

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the id primary key).
    const findOne = db.makeQuery((execute, spec: Specification<SessionRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SessionRowStd)`
          SELECT * FROM auth.sessions
          WHERE ${criteriaToWhere(spec.criteria, SessionMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : SessionMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("SessionRepository.findOne"),
      ),
    );

    const deleteById = db.makeQuery((execute, id: SessionId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SessionRowStd)`
          UPDATE auth.sessions SET revoked_at = now()
          WHERE id = ${id} AND revoked_at IS NULL
          RETURNING *
        `),
      ).pipe(
        orFail(() => new SessionNotFound({ sessionId: id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("SessionRepository.deleteOne"),
      ),
    );

    const updateOne = db.makeQuery((execute, session: SessionRoot) => {
      const row = SessionMapper.toPersistence(session);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SessionRowStd)`
          UPDATE auth.sessions
          SET expires_at = ${sql.timestamp(row.expires_at)},
              last_used_at = ${sql.timestamp(row.last_used_at)}
          WHERE id = ${row.id} AND revoked_at IS NULL
          RETURNING *
        `),
      ).pipe(
        orFail(() => new SessionNotFound({ sessionId: session.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("SessionRepository.updateOne"),
      );
    });

    return SessionRepository.of({ insertOne, findOne, deleteOne: deleteById, updateOne });
  }),
);
