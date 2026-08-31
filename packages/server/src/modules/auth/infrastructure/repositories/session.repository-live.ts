import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SessionNotFound } from "@/modules/auth/domain/session/session.errors.js";
import { type SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import { type SessionRoot } from "@/modules/auth/domain/session/session.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as SessionMapper from "./session.mapper.js";

export const SessionRepositoryLive = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("SessionRepository.insertOne")((session: SessionRoot) => {
      const row = SessionMapper.toPersistence(session);
      return sql`
          INSERT INTO auth.sessions
            (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
          VALUES (
            ${row.id},
            ${row.user_id},
            ${row.subject},
            ${row.expires_at},
            ${row.absolute_expires_at},
            ${row.revoked_at},
            ${row.created_at},
            ${row.last_used_at}
          )
        `.pipe(Database.exec, translateDatabaseErrors);
    });

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the id primary key).
    const findOne = Effect.fn("SessionRepository.findOne")((spec: Specification<SessionRoot>) =>
      sql`
          SELECT * FROM auth.sessions
          WHERE ${criteriaToWhere(sql, spec.criteria, SessionMapper.columns)}
          LIMIT 1
        `.pipe(
        Database.maybeRow(RowSchemas.SessionRow),

        Effect.map((row) => (row === null ? null : SessionMapper.toDomain(row))),
        translateDatabaseErrors,
      ),
    );

    const deleteById = Effect.fn("SessionRepository.deleteOne")((id: SessionId) =>
      sql`
          UPDATE auth.sessions SET revoked_at = now()
          WHERE id = ${id} AND revoked_at IS NULL
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.SessionRow),

        orFail(() => new SessionNotFound({ sessionId: id })),
        Effect.asVoid,
        translateDatabaseErrors,
      ),
    );

    const updateOne = Effect.fn("SessionRepository.updateOne")((session: SessionRoot) => {
      const row = SessionMapper.toPersistence(session);
      return sql`
          UPDATE auth.sessions
          SET expires_at = ${row.expires_at},
              last_used_at = ${row.last_used_at}
          WHERE id = ${row.id} AND revoked_at IS NULL
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.SessionRow),

        orFail(() => new SessionNotFound({ sessionId: session.id })),
        Effect.asVoid,
        translateDatabaseErrors,
      );
    });

    return SessionRepository.of({ insertOne, findOne, deleteOne: deleteById, updateOne });
  }),
);
