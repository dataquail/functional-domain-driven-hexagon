import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.ts";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.ts";
import { ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.ts";

// Resolves the specification field names the live repository filters on to
// physical columns of auth.api_tokens. Only filterable scalar fields need an
// entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  id: "id",
  tokenHash: "token_hash",
  userId: "user_id",
  revokedAt: "revoked_at",
} as const satisfies Partial<Record<keyof ApiTokenRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.ApiTokenRow): ApiTokenRoot =>
  ApiTokenRoot.make({
    id: ApiTokenId.make(row.id),
    userId: UserId.make(row.user_id),
    tokenHash: row.token_hash,
    prefix: row.prefix,
    label: row.label,
    expiresAt: Option.fromNullOr(row.expires_at),
    revokedAt: Option.fromNullOr(row.revoked_at),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });

export const toPersistence = (token: ApiTokenRoot) => ({
  id: token.id,
  user_id: token.userId,
  token_hash: token.tokenHash,
  prefix: token.prefix,
  label: token.label,
  expires_at: Option.getOrNull(Option.map(token.expiresAt, DateTime.toDate)),
  revoked_at: Option.getOrNull(Option.map(token.revokedAt, DateTime.toDate)),
  created_at: DateTime.toDate(token.createdAt),
  last_used_at: DateTime.toDate(token.lastUsedAt),
});
