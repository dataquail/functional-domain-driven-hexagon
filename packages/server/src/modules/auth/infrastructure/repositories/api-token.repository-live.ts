import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import { type ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { type ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { type UserId } from "@/platform/ids/user-id.js";
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

    const findOneById = db.makeQuery((execute, id: ApiTokenId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new ApiTokenNotFound()),
        Effect.map(ApiTokenMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.findOneById"),
      ),
    );

    const findOneByHash = db.makeQuery((execute, tokenHash: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens WHERE token_hash = ${tokenHash}
        `),
      ).pipe(
        orFail(() => new ApiTokenNotFound()),
        Effect.map(ApiTokenMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.findOneByHash"),
      ),
    );

    const findManyByUser = db.makeQuery((execute, userId: UserId) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens
          WHERE user_id = ${userId} AND revoked_at IS NULL
          ORDER BY created_at DESC
        `),
      ).pipe(
        Effect.map((rows) => rows.map(ApiTokenMapper.toDomain)),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.findManyByUser"),
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
      findOneById,
      findOneByHash,
      findManyByUser,
      deleteOne: deleteById,
      updateOne,
    });
  }),
);
