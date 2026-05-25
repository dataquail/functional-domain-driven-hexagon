import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type Organization } from "../domain/organization.aggregate.js";

// Phase 2 contribution. Per-org member checks (the `IsMember` half of
// `update`/`read`) land with Phase 3 once the membership module
// exposes a `MembershipService` ACL — until then every per-resource
// gate falls back to `SuperAdminOnly`. Admin-side `read` on
// `/api/admin/orgs` is also gated by `SuperAdminOnly` and exercised
// via `Authz.hasPermissions(OrganizationResource, Actions.Read)` (no
// id — flat action on the resource).

declare module "@/platform/auth/resource-resolver-registry.js" {
  interface ResourceResolverMap {
    organization: { resourceType: Organization; idType: OrganizationId };
  }
}

declare module "@/platform/auth/policy-registry.js" {
  interface PolicyMap {
    organization: {
      read: PolicyRegistry.CheckFor<"organization", "read">;
      update: PolicyRegistry.CheckFor<"organization", "update">;
      delete: PolicyRegistry.CheckFor<"organization", "delete">;
    };
  }
}

export const OrganizationResource = "organization" as const;

export const organizationPolicies: PolicyRegistry.PolicyContribution = {
  organization: {
    read: SuperAdminOnly,
    update: SuperAdminOnly,
    delete: SuperAdminOnly,
  },
};
