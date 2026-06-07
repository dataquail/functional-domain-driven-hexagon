import { makeIsOrgMember } from "@/platform/auth/policies/is-org-member.js";

import { type BillingResourceContext } from "./billing-resource-resolver.js";

// "Is this caller a member of the billing-resource's org?" — the
// billing resource resolves to `{ organizationId }` (an echo of the
// path orgId), so we hand the same field to the platform factory. All
// the lookup logic lives in `makeIsOrgMember` over `MembershipService`.
export const IsBillingOrgMember = makeIsOrgMember(
  (resource: BillingResourceContext) => resource.organizationId,
);
