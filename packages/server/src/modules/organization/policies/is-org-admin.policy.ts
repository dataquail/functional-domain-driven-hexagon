import { makeIsOrgAdmin } from "@/platform/auth/policies/is-org-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";

// "Is this caller an admin of this organization?" — the `organization`
// resource resolves to the Organization aggregate, so the org id is
// `.id`. The lookup against `OrganizationRoleService` lives in the
// shared `makeIsOrgAdmin` factory (platform); this module supplies
// only the resource→orgId extractor. Same pattern as `IsMember`.
//
// Composed via `Authz.any(SuperAdminOnly, IsOrgAdmin)` so super-admins
// bypass the per-org role lookup.
export const IsOrgAdmin: PolicyRegistry.CheckFor<"organization", "update"> = makeIsOrgAdmin(
  (organization) => organization.id,
);
