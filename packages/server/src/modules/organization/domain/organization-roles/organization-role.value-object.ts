import * as Schema from "effect/Schema";

// Closed set of role names a user can hold within one organization.
// Phase 4 introduces only `admin` — the role that gates org-management
// operations (invite, remove-member, future promote/demote). Plain
// membership (per the `MembershipRoot` aggregate + `IsMember` check) is the
// floor; this enum names the *elevated* roles above that floor.
//
// Adding a new role: extend the literal here (and `KNOWN_ORG_ROLES` in
// `organization-roles-mapper.ts` and `organization-role-service-live.ts`).
export const OrganizationRoleValueObject = Schema.Literal("admin");
export type OrganizationRoleValueObject = typeof OrganizationRoleValueObject.Type;
