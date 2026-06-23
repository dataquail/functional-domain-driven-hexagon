import * as Check from "@/platform/auth/check.js";
import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type Organization } from "../domain/organization.aggregate.js";
import { IsMemberRead } from "./is-member.js";
import { IsOrgAdmin } from "./is-org-admin.js";

// Phase 4 contribution. `update` (which gates invite, revoke, and
// remove-member endpoints) requires the `admin` OrganizationRole —
// plain members no longer manage members.
// The creator of an org is auto-granted `admin` in
// `create-organization.ts`.
// `read` is `any(SuperAdminOnly, IsMemberRead)`: the org-scoped
// `findMembers` endpoint passes an orgId so any member of that org may
// read the roster (managing it stays `update`-gated), while the
// super-admin `findAll` listing passes no id — `IsMemberRead` denies
// the missing-resource case, so non-super-admins are still rejected
// there. `delete` stays super-admin-only — tombstoning an org is a
// platform-level operation.

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
    read: Check.any(SuperAdminOnly, IsMemberRead),
    update: Check.any(SuperAdminOnly, IsOrgAdmin),
    delete: SuperAdminOnly,
  },
};
