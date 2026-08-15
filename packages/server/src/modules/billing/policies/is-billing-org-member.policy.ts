import { type ResourceCheck } from "@org/authz";

import { type OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";

import { type BillingResourceContext } from "./billing.resource-resolver.js";

// "Is this caller a member of the billing-resource's org?" — gates reading the
// subscription. The port arrives as an argument rather than through the Effect
// environment, so the returned check is `R = never`.
export const makeIsBillingOrgMember =
  (organizations: OrganizationAccess["Service"]): ResourceCheck<BillingResourceContext> =>
  (caller, resource) =>
    organizations.isMember(caller.userId, resource.organizationId);
