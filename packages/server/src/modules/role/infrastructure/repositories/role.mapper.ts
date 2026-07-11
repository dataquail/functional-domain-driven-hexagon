import { type RowSchemas } from "@org/database/index";

import { type RoleValueObject } from "@/modules/role/domain/roles/role.value-object.js";
import { RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Closed set of recognized role names. Mirrors the `RoleValueObject` Schema literal
// in `domain/role.ts` — adding a new role requires updating both.
const KNOWN_ROLES = new Set<string>(["super_admin"]);

const narrow = (role: string): role is RoleValueObject => KNOWN_ROLES.has(role);

// Builds a `RolesRoot` aggregate from raw `platform.roles` rows. The caller
// (the live repository) groups rows by user_id and hands the slice for
// one user here. Unknown role strings (never inserted by application
// code) are filtered out rather than crashing the read — defense in
// depth.
export const toDomain = (
  userId: UserId,
  rows: ReadonlyArray<RowSchemas.PlatformRoleRow>,
): RolesRoot =>
  RolesRoot.make({
    userId,
    roles: rows.map((r) => r.role).filter(narrow),
  });
