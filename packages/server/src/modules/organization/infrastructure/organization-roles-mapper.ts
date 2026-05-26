import { type RowSchemas } from "@org/database/index";

import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { type OrganizationRole } from "../domain/organization-role.js";
import { IssuedRole, OrganizationRoles } from "../domain/organization-roles.aggregate.js";

// Closed set of recognized role names. Mirrors the `OrganizationRole`
// Schema literal in `domain/organization-role.ts` — adding a new role
// requires updating both.
const KNOWN_ROLES = new Set<string>(["admin"]);

const narrow = (role: string): role is OrganizationRole => KNOWN_ROLES.has(role);

// Builds an `OrganizationRoles` aggregate from raw
// `organization.organization_roles` rows. The caller (the live
// repository) groups rows by `(user_id, organization_id)` and hands
// the slice for one pair here. Unknown role strings (never inserted by
// application code) are filtered out rather than crashing the read —
// defense in depth, same pattern as `role-mapper.ts`.
export const toDomain = (
  userId: UserId,
  organizationId: OrganizationId,
  rows: ReadonlyArray<RowSchemas.OrganizationRoleRow>,
): OrganizationRoles =>
  OrganizationRoles.make({
    userId,
    organizationId,
    roles: rows
      .filter((r) => narrow(r.role))
      .map((r) =>
        IssuedRole.make({
          role: r.role as OrganizationRole,
          issuedBy: UserId.make(r.issued_by),
        }),
      ),
  });
