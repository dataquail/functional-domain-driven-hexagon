import { UserId } from "@/platform/ids/user-id.js";
import { type RowSchemas } from "@org/database/index";
import { type AuthIdentity } from "../domain/auth-identity-repository.js";

export const toDomain = (row: RowSchemas.AuthIdentityRow): AuthIdentity => ({
  subject: row.subject,
  userId: UserId.make(row.user_id),
  provider: row.provider,
});
