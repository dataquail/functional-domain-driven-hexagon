import * as Check from "@/platform/auth/check.js";
import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type Organization } from "../domain/organization.aggregate.js";
import { IsOrgAdmin } from "./is-org-admin.js";

// Phase 4 contribution. `update` (which gates invite, revoke,
// remove-member, and future promote/demote endpoints) now requires the
// `admin` OrganizationRole — plain members no longer manage members.
// The creator of an org is auto-granted `admin` in
// `create-organization.ts`. `read` stays super-admin-only because the
// only `Authz.hasPermissions("organization", Actions.Read)` call site
// today is the admin-side `findAll` listing (flat, no id) — `IsMember`
// can't run against a missing resource. `delete` stays super-admin-only
// — tombstoning an org is a platform-level operation.

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
    update: Check.any(SuperAdminOnly, IsOrgAdmin),
    delete: SuperAdminOnly,
  },
};
