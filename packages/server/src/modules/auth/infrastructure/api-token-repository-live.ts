import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type UserId } from "@/platform/ids/user-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import { type ApiToken } from "../domain/api-token.aggregate.js";
import { ApiTokenNotFound } from "../domain/api-token-errors.js";
import { type ApiTokenId } from "../domain/api-token-id.js";
import { ApiTokenRepository } from "../domain/ports/repositories/api-token-repository.js";
import * as ApiTokenMapper from "./api-token-mapper.js";

export const ApiTokenRepositoryLive = Layer.effect(
  ApiTokenRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, token: ApiToken) => {
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
        Effect.withSpan("ApiTokenRepository.insert"),
      );
    });

    const findById = db.makeQuery((execute, id: ApiTokenId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new ApiTokenNotFound()),
        Effect.map(ApiTokenMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.findById"),
      ),
    );

    const findByHash = db.makeQuery((execute, tokenHash: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens WHERE token_hash = ${tokenHash}
        `),
      ).pipe(
        orFail(() => new ApiTokenNotFound()),
        Effect.map(ApiTokenMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("ApiTokenRepository.findByHash"),
      ),
    );

    const listByUser = db.makeQuery((execute, userId: UserId) =>
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
        Effect.withSpan("ApiTokenRepository.listByUser"),
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
        Effect.withSpan("ApiTokenRepository.delete"),
      ),
    );

    const update = db.makeQuery((execute, token: ApiToken) => {
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
        Effect.withSpan("ApiTokenRepository.update"),
      );
    });

    return ApiTokenRepository.of({
      insert,
      findById,
      findByHash,
      listByUser,
      delete: deleteById,
      update,
    });
  }),
);
