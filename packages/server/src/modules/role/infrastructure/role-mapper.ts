import { type RowSchemas } from "@org/database/index";

import { type UserId } from "@/platform/ids/user-id.js";

import { type Role } from "../domain/role.js";
import { Roles } from "../domain/roles.aggregate.js";

// Closed set of recognized role names. Mirrors the `Role` Schema literal
// in `domain/role.ts` — adding a new role requires updating both.
const KNOWN_ROLES = new Set<string>(["super_admin"]);

const narrow = (role: string): role is Role => KNOWN_ROLES.has(role);

// Builds a `Roles` aggregate from raw `platform.roles` rows. The caller
// (the live repository) groups rows by user_id and hands the slice for
// one user here. Unknown role strings (never inserted by application
// code) are filtered out rather than crashing the read — defense in
// depth.
export const toDomain = (userId: UserId, rows: ReadonlyArray<RowSchemas.PlatformRoleRow>): Roles =>
  Roles.make({
    userId,
    roles: rows.map((r) => r.role).filter(narrow),
  });
