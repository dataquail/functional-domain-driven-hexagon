import { UserId } from "@/platform/ids/user-id.js";
import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import { SessionId } from "../domain/session-id.js";
import { Session } from "../domain/session.aggregate.js";

export const toDomain = (row: RowSchemas.SessionRow): Session =>
  Session.make({
    id: SessionId.make(row.id),
    userId: UserId.make(row.user_id),
    subject: row.subject,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });

export const toPersistence = (session: Session) => ({
  id: session.id,
  user_id: session.userId,
  subject: session.subject,
  expires_at: DateTime.toDate(session.expiresAt),
  absolute_expires_at: DateTime.toDate(session.absoluteExpiresAt),
  revoked_at: session.revokedAt === null ? null : DateTime.toDate(session.revokedAt),
  created_at: DateTime.toDate(session.createdAt),
  last_used_at: DateTime.toDate(session.lastUsedAt),
});
