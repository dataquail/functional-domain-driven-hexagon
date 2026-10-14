import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type Specification } from "@/globals/application/ddd/specification.ts";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql.ts";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.ts";
import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.ts";
import { type ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.ts";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.ts";
import { type ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.ts";

import * as ApiTokenMapper from "./api-token.mapper.ts";

export const ApiTokenRepositoryLive = Layer.effect(
  ApiTokenRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("ApiTokenRepository.insertOne")((token: ApiTokenRoot) => {
      const row = ApiTokenMapper.toPersistence(token);

      return sql`
          INSERT INTO auth.api_tokens
            (id, user_id, token_hash, prefix, label, expires_at, revoked_at, created_at, last_used_at)
          VALUES (
            ${row.id},
            ${row.user_id},
            ${row.token_hash},
            ${row.prefix},
            ${row.label},
            ${row.expires_at},
            ${row.revoked_at},
            ${row.created_at},
            ${row.last_used_at}
          )
        `.pipe(Database.exec, translateDatabaseErrors);
    });

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the id primary key, the unique token_hash).
    const findOne = Effect.fn("ApiTokenRepository.findOne")((spec: Specification<ApiTokenRoot>) =>
      criteriaToWhere(sql, spec.criteria, ApiTokenMapper.columns).pipe(
        Effect.flatMap(
          (where) => sql`
          SELECT * FROM auth.api_tokens
          WHERE ${where}
          LIMIT 1
        `,
        ),
        Database.maybeRow(RowSchemas.ApiTokenRow),

        Effect.map(Option.map(ApiTokenMapper.toDomain)),
        translateDatabaseErrors,
      ),
    );

    // The repository owns the newest-first ordering; the spec (e.g. forUser)
    // contributes the WHERE, including the `revoked_at IS NULL` active filter.
    const findMany = Effect.fn("ApiTokenRepository.findMany")((spec: Specification<ApiTokenRoot>) =>
      criteriaToWhere(sql, spec.criteria, ApiTokenMapper.columns).pipe(
        Effect.flatMap(
          (where) => sql`
          SELECT * FROM auth.api_tokens
          WHERE ${where}
          ORDER BY created_at DESC
        `,
        ),
        Database.rows(RowSchemas.ApiTokenRow),

        Effect.map((rows) => rows.map(ApiTokenMapper.toDomain)),
        translateDatabaseErrors,
      ),
    );

    const deleteById = Effect.fn("ApiTokenRepository.deleteOne")((id: ApiTokenId) =>
      sql`
          UPDATE auth.api_tokens SET revoked_at = now()
          WHERE id = ${id} AND revoked_at IS NULL
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.ApiTokenRow),

        orFail(() => new ApiTokenNotFound()),
        Effect.asVoid,
        translateDatabaseErrors,
      ),
    );

    const updateOne = Effect.fn("ApiTokenRepository.updateOne")((token: ApiTokenRoot) => {
      const row = ApiTokenMapper.toPersistence(token);

      return sql`
          UPDATE auth.api_tokens
          SET last_used_at = ${row.last_used_at}
          WHERE id = ${row.id} AND revoked_at IS NULL
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.ApiTokenRow),

        orFail(() => new ApiTokenNotFound()),
        Effect.asVoid,
        translateDatabaseErrors,
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
