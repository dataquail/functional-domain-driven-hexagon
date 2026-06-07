import * as Effect from "effect/Effect";

import { type ResourceCheck } from "@/platform/auth/policy-registry.js";
import { OrganizationRoleService } from "@/platform/ddd/ports/organization-role-service.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Reusable "does this caller hold the `admin` role for the resource's
// org?" check, parameterized by how *this* resource yields its org
// id. Mirrors `makeIsOrgMember` — the lookup against
// `OrganizationRoleService` is the uniform, cross-cutting part, so
// each consumer supplies only the resource→orgId extractor.
//
// Compose via `Authz.any(SuperAdminOnly, makeIsOrgAdmin(...))` so
// super-admins short-circuit ahead of the per-org role read.
export const makeIsOrgAdmin =
  <R>(getOrganizationId: (resource: R) => OrganizationId): ResourceCheck<R> =>
  (caller, resource) =>
    Effect.gen(function* () {
      const orgRoles = yield* OrganizationRoleService;
      const perms = yield* orgRoles.findOrganizationPermissions(
        caller.userId,
        getOrganizationId(resource),
      );
      return perms.roles.includes("admin");
    });
