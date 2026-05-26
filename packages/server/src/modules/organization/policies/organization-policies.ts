import * as Check from "@/platform/auth/check.js";
import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type Organization } from "../domain/organization.aggregate.js";
import { IsMember } from "./is-member.js";

// Phase 3 contribution. `update` now allows any member of the org (in
// addition to super-admins) — the same policy gates invite, revoke,
// remove-member endpoints. `delete` stays super-admin-only because
// tombstoning an org is a platform-level operation. `read` will become
// `any(SuperAdminOnly, IsMember)` once a `findMyOrganizations` endpoint
// lands; the admin-side `findAll` reads use `Actions.Read` flat without
// an id and remain super-admin-only.

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
    update: Check.any(SuperAdminOnly, IsMember),
    delete: SuperAdminOnly,
  },
};
