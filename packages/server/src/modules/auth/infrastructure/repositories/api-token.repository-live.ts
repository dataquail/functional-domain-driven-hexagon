import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import { type ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { type ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as ApiTokenMapper from "./api-token.mapper.js";

export const ApiTokenRepositoryLive = Layer.effect(
  ApiTokenRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, token: ApiTokenRoot) => {
      const row = ApiTokenMapper.toPersistence(token);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO auth.api_tokens
            (id, user_id, token_hash, prefix, label, expires_at, revoked_at, created_at, last_used_at)
          VALUES (
            ${row.id},
            ${row.user_id},
            ${row.token_hash},
            ${row.prefix},
            ${row.label},
            ${row.expires_at === null ? null : sql.timestamp(row.expires_at)},
            ${row.revoked_at === null ? null : sql.timestamp(row.revoked_at)},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.last_used_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.insertOne"),
      );
    });

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the id primary key, the unique token_hash).
    const findOne = db.makeQuery((execute, spec: Specification<ApiTokenRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens
          WHERE ${criteriaToWhere(spec.criteria, ApiTokenMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : ApiTokenMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.findOne"),
      ),
    );

    // The repository owns the newest-first ordering; the spec (e.g. forUser)
    // contributes the WHERE, including the `revoked_at IS NULL` active filter.
    const findMany = db.makeQuery((execute, spec: Specification<ApiTokenRoot>) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens
          WHERE ${criteriaToWhere(spec.criteria, ApiTokenMapper.columns)}
          ORDER BY created_at DESC
        `),
      ).pipe(
        Effect.map((rows) => rows.map(ApiTokenMapper.toDomain)),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.findMany"),
      ),
    );

    const deleteById = db.makeQuery((execute, id: ApiTokenId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          UPDATE auth.api_tokens SET revoked_at = now()
          WHERE id = ${id} AND revoked_at IS NULL
          RETURNING *
        `),
      ).pipe(
        orFail(() => new ApiTokenNotFound()),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.deleteOne"),
      ),
    );

    const updateOne = db.makeQuery((execute, token: ApiTokenRoot) => {
      const row = ApiTokenMapper.toPersistence(token);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          UPDATE auth.api_tokens
          SET last_used_at = ${sql.timestamp(row.last_used_at)}
          WHERE id = ${row.id} AND revoked_at IS NULL
          RETURNING *
        `),
      ).pipe(
        orFail(() => new ApiTokenNotFound()),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.updateOne"),
      );
    });

    return ApiTokenRepository.of({
      insertOne,
      findOne,
      findMany,
      deleteOne: deleteById,
      updateOne,
    });
  }),
);
