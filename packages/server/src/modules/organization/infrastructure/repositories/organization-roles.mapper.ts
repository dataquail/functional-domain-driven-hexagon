import { type RowSchemas } from "@org/database/index";

import { type OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import {
  IssuedRoleValueObject,
  OrganizationRolesRoot,
} from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Closed set of recognized role names. Mirrors the `OrganizationRoleValueObject`
// Schema literal in `domain/organization-roles/organization-role.value-object.ts` — adding a new role
// requires updating both.
const KNOWN_ROLES = new Set<string>(["admin"]);

const narrow = (role: string): role is OrganizationRoleValueObject => KNOWN_ROLES.has(role);

// Builds an `OrganizationRolesRoot` aggregate from raw
// `organization.organization_roles` rows. The caller (the live
// repository) groups rows by `(user_id, organization_id)` and hands
// the slice for one pair here. Unknown role strings (never inserted by
// application code) are filtered out rather than crashing the read —
// defense in depth, same pattern as `role-mapper.ts`.
export const toDomain = (
  userId: UserId,
  organizationId: OrganizationId,
  rows: ReadonlyArray<RowSchemas.OrganizationRoleRow>,
): OrganizationRolesRoot =>
  OrganizationRolesRoot.make({
    userId,
    organizationId,
    roles: rows
      .filter((r) => narrow(r.role))
      .map((r) =>
        IssuedRoleValueObject.make({
          role: r.role as OrganizationRoleValueObject,
          issuedBy: UserId.make(r.issued_by),
        }),
      ),
  });
