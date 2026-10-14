import { type RowSchemas } from "@org/database/index";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.js";
import { type OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import {
  IssuedRoleValueObject,
  OrganizationRolesRoot,
} from "@/modules/organization/domain/organization-roles/organization-roles.root.js";

type Row = RowSchemas.OrganizationRoleRow;

// Closed set of recognized role names. Mirrors the `OrganizationRoleValueObject`
// Schema literal in `domain/organization-roles/organization-role.value-object.ts` — adding a new role
// requires updating both.
const KNOWN_ROLES = new Set<string>(["admin"]);

const isKnownRole = (role: string): role is OrganizationRoleValueObject => KNOWN_ROLES.has(role);

// Field → column map for spec translation. Only the composite-key fields are
// filterable; `roles` is a child collection with no scalar column, which is why
// `hasRole` stays an eval-only Predicate and never reaches this map.
export const columns = {
  userId: "user_id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof OrganizationRolesRoot, string>> & ColumnMap;

// Reconstitutes ONE aggregate from the rows the repository fetched for a single
// (user, org) pair. Zero rows → `None`; the caller decides that "no rows" means
// an empty aggregate. Identity is read from the rows themselves — every row of
// the aggregate carries the composite key. Unknown role strings (never inserted
// by application code) are filtered out rather than crashing the read.
const toIssuedRole = (row: Row): ReadonlyArray<IssuedRoleValueObject> => {
  const { role } = row;

  if (!isKnownRole(role)) return [];

  return [IssuedRoleValueObject.make({ role, issuedBy: UserId.make(row.issued_by) })];
};

export const toDomain = (rows: ReadonlyArray<Row>): Option.Option<OrganizationRolesRoot> =>
  Option.map(Arr.head(rows), (first) =>
    OrganizationRolesRoot.make({
      userId: UserId.make(first.user_id),
      organizationId: OrganizationId.make(first.organization_id),
      roles: rows.flatMap(toIssuedRole),
    }),
  );
