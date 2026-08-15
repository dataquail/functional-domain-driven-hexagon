import { type ResourceCheck } from "@org/authz";

import { type OrganizationAuthzView } from "@/modules/organization/queries/find-organization-by-id.query.js";

import { type UserOrganizationLookup } from "./is-member.policy.js";

// "Is this caller an admin of this organization?" — gates managing the roster
// (invite, revoke, remove, promote, demote). Plain membership is not enough.
//
// Same shape as `makeIsMember`: org roles are this module's own data, so the
// lookup is a plain function the contribution layer supplies from this module's
// own policy-query.
export const makeIsOrgAdmin =
  (isAdmin: UserOrganizationLookup): ResourceCheck<OrganizationAuthzView> =>
  (caller, organization) =>
    isAdmin(caller.userId, organization.organizationId);
