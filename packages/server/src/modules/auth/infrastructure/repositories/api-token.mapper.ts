import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { UserId } from "@/platform/ids/user-id.js";

export const toDomain = (row: RowSchemas.ApiTokenRow): ApiTokenRoot =>
  ApiTokenRoot.make({
    id: ApiTokenId.make(row.id),
    userId: UserId.make(row.user_id),
    tokenHash: row.token_hash,
    prefix: row.prefix,
    label: row.label,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });

export const toPersistence = (token: ApiTokenRoot) => ({
  id: token.id,
  user_id: token.userId,
  token_hash: token.tokenHash,
  prefix: token.prefix,
  label: token.label,
  expires_at: token.expiresAt === null ? null : DateTime.toDate(token.expiresAt),
  revoked_at: token.revokedAt === null ? null : DateTime.toDate(token.revokedAt),
  created_at: DateTime.toDate(token.createdAt),
  last_used_at: DateTime.toDate(token.lastUsedAt),
});
