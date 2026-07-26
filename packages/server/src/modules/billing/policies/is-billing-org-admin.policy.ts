import { type OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import { type ResourceCheck } from "@/platform/auth/policy-registry.js";

import { type BillingResourceContext } from "./billing.resource-resolver.js";

// "May this caller commit the org to a subscription?" — gates subscribe and
// cancel. Which org role confers that authority is the adapter's decision; this
// check only asks the question.
export const makeIsBillingOrgAdmin =
  (organizations: OrganizationAccess["Service"]): ResourceCheck<BillingResourceContext> =>
  (caller, resource) =>
    organizations.isAdmin(caller.userId, resource.organizationId);
