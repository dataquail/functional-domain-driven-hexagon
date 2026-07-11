import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import {
  type ApiTokenView,
  type ListMyApiTokensQuery,
} from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

const toView = (row: RowSchemas.ApiTokenRow): ApiTokenView => ({
  id: ApiTokenId.make(row.id),
  label: row.label,
  prefix: row.prefix,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

export const listMyApiTokens = Effect.fn("listMyApiTokens")(function* (
  query: ListMyApiTokensQuery,
) {
  const db = yield* Database.Database;
  const rows = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens
          WHERE user_id = ${query.userId} AND revoked_at IS NULL
          ORDER BY created_at DESC
        `),
      ),
    )()
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );
  return rows.map(toView);
});
