import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import {
  type ApiTokenView,
  type ListMyApiTokensPayload,
} from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const toView = (row: RowSchemas.ApiTokenRow): ApiTokenView => ({
  id: ApiTokenId.make(row.id),
  label: row.label,
  prefix: row.prefix,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

export const listMyApiTokensHandler = Effect.fn("listMyApiTokensHandler")(function* (
  query: ListMyApiTokensPayload,
) {
  const sql = yield* Database.Database;
  const rows = yield* sql`
          SELECT * FROM auth.api_tokens
          WHERE user_id = ${query.userId} AND revoked_at IS NULL
          ORDER BY created_at DESC
        `
    .pipe(Database.rows(RowSchemas.ApiTokenRow))
    .pipe(translateDatabaseErrors);
  return rows.map(toView);
});
