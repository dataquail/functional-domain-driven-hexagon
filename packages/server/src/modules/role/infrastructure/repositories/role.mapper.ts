import { type RowSchemas } from "@org/database/index";

import { type RoleValueObject } from "@/modules/role/domain/roles/role.value-object.js";
import { RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

type Row = RowSchemas.PlatformRoleRow;

// Closed set of recognized role names. Mirrors the `RoleValueObject` Schema literal
// in `domain/roles/role.value-object.ts` — adding a new role requires updating both.
const KNOWN_ROLES = new Set<string>(["super_admin"]);

const narrow = (role: string): role is RoleValueObject => KNOWN_ROLES.has(role);

// Field → column map for spec translation. Only `userId` is filterable; `roles`
// is a child collection with no scalar column, which is why `hasRole` stays an
// eval-only Predicate and never reaches this map.
export const columns = {
  userId: "user_id",
} as const satisfies Partial<Record<keyof RolesRoot, string>> & ColumnMap;

// Reconstitutes ONE aggregate from the rows the repository fetched for a single
// user. Zero rows → `null`; the caller decides that "no rows" means an empty
// aggregate. Identity is read from the rows themselves — every row carries
// `user_id`. Unknown role strings (never inserted by application code) are
// filtered out rather than crashing the read.
export const toDomain = (rows: ReadonlyArray<Row>): RolesRoot | null => {
  const first = rows[0];
  if (first === undefined) return null;
  return RolesRoot.make({
    userId: UserId.make(first.user_id),
    roles: rows.map((r) => r.role).filter(narrow),
  });
};
