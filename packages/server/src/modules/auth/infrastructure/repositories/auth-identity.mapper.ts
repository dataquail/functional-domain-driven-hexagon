import { type RowSchemas } from "@org/database/index";

import { type AuthIdentity } from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { UserId } from "@/platform/ids/user-id.js";

export const toDomain = (row: RowSchemas.AuthIdentityRow): AuthIdentity => ({
  subject: row.subject,
  userId: UserId.make(row.user_id),
  provider: row.provider,
});
