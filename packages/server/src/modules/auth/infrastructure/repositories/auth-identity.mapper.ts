import { type RowSchemas } from "@org/database/index";

import { type AuthIdentity } from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

// Resolves the specification field names the live repository filters on to
// physical columns of auth.auth_identities. Only filterable scalar fields need
// an entry; `satisfies` keeps the keys honest against the domain type.
export const columns = {
  subject: "subject",
} as const satisfies Partial<Record<keyof AuthIdentity, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.AuthIdentityRow): AuthIdentity => ({
  subject: row.subject,
  userId: UserId.make(row.user_id),
  provider: row.provider,
});
