import * as Effect from "effect/Effect";

import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { OrganizationRoleService } from "@/platform/ddd/ports/organization-role-service.js";

// Per-org "is this caller an admin of this organization?" check.
// Consumes the platform-layer `OrganizationRoleService` ACL (never the
// org module's `OrganizationRolesRepository` directly) so the dep graph
// stays acyclic and the consuming-policy surface depends only on the
// generalized role-name shape.
//
// Typed via `PolicyRegistry.CheckFor<"organization", "update">` so the
// R channel resolves to the full `PolicyDeps` set — that lets
// `Authz.any(SuperAdminOnly, IsOrgAdmin)` type-check uniformly even
// though each check uses a different platform service (RoleService vs
// OrganizationRoleService). Same shape as `IsMember`.
//
// Composed via `Authz.any(SuperAdminOnly, IsOrgAdmin)` so super-admins
// bypass the per-org role lookup (short-circuit on the first `true`).
export const IsOrgAdmin: PolicyRegistry.CheckFor<"organization", "update"> = (
  caller,
  organization,
) =>
  Effect.gen(function* () {
    const orgRoles = yield* OrganizationRoleService;
    const perms = yield* orgRoles.findOrganizationPermissions(caller.userId, organization.id);
    return perms.roles.includes("admin");
  });
