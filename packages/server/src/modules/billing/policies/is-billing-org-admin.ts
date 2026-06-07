import { makeIsOrgAdmin } from "@/platform/auth/policies/is-org-admin.js";

import { type BillingResourceContext } from "./billing-resource-resolver.js";

// "Is this caller an org-admin for the billing-resource's org?" —
// gates subscription mutation (subscribe + cancel). Same shape as
// `IsBillingOrgMember`; only the platform ACL differs.
export const IsBillingOrgAdmin = makeIsOrgAdmin(
  (resource: BillingResourceContext) => resource.organizationId,
);
