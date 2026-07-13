import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRoot } from "@/modules/auth/domain/session/session.root.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

// Resolves the specification field names the live repository filters on to
// physical columns of auth.sessions. Only filterable scalar fields need an
// entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  id: "id",
} as const satisfies Partial<Record<keyof SessionRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.SessionRow): SessionRoot =>
  SessionRoot.make({
    id: SessionId.make(row.id),
    userId: UserId.make(row.user_id),
    subject: row.subject,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });

export const toPersistence = (session: SessionRoot) => ({
  id: session.id,
  user_id: session.userId,
  subject: session.subject,
  expires_at: DateTime.toDate(session.expiresAt),
  absolute_expires_at: DateTime.toDate(session.absoluteExpiresAt),
  revoked_at: session.revokedAt === null ? null : DateTime.toDate(session.revokedAt),
  created_at: DateTime.toDate(session.createdAt),
  last_used_at: DateTime.toDate(session.lastUsedAt),
});
