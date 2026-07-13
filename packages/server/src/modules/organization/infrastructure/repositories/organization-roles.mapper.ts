import { type RowSchemas } from "@org/database/index";

import { type OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import {
  IssuedRoleValueObject,
  OrganizationRolesRoot,
} from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

type Row = RowSchemas.OrganizationRoleRow;

// Closed set of recognized role names. Mirrors the `OrganizationRoleValueObject`
// Schema literal in `domain/organization-roles/organization-role.value-object.ts` — adding a new role
// requires updating both.
const KNOWN_ROLES = new Set<string>(["admin"]);

const narrow = (role: string): role is OrganizationRoleValueObject => KNOWN_ROLES.has(role);

// Field → column map for spec translation. Only the composite-key fields are
// filterable; `roles` is a child collection with no scalar column, which is why
// `hasRole` stays an eval-only Predicate and never reaches this map.
export const columns = {
  userId: "user_id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof OrganizationRolesRoot, string>> & ColumnMap;

// Reconstitutes ONE aggregate from the rows the repository fetched for a single
// (user, org) pair. Zero rows → `null`; the caller decides that "no rows" means
// an empty aggregate. Identity is read from the rows themselves — every row of
// the aggregate carries the composite key. Unknown role strings (never inserted
// by application code) are filtered out rather than crashing the read.
export const toDomain = (rows: ReadonlyArray<Row>): OrganizationRolesRoot | null => {
  const first = rows[0];
  if (first === undefined) return null;
  return OrganizationRolesRoot.make({
    userId: UserId.make(first.user_id),
    organizationId: OrganizationId.make(first.organization_id),
    roles: rows
      .filter((r) => narrow(r.role))
      .map((r) =>
        IssuedRoleValueObject.make({
          role: r.role as OrganizationRoleValueObject,
          issuedBy: UserId.make(r.issued_by),
        }),
      ),
  });
};
