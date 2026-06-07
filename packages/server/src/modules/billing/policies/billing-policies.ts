import * as Check from "@/platform/auth/check.js";
import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";

import { IsBillingOrgAdmin } from "./is-billing-org-admin.js";
import { IsBillingOrgMember } from "./is-billing-org-member.js";

// Billing's single policy resource gates two CRUD operations:
//   - `read` (GET current subscription) — every member of the org may
//     see the subscription state.
//   - `update` (POST subscribe, DELETE cancel) — only Org Admins may
//     take on a financial commitment. CRUD vocabulary maps both
//     "subscribe" and "cancel" to `Actions.Update`; the verb-level
//     distinction surfaces at the URL.
//
// Super-admins bypass both via `Check.any(SuperAdminOnly, …)`.
//
// The Stripe webhook endpoint is NOT covered here — it has no policy.
// Authentication is by signature, verified by `BillingGateway` inside
// the endpoint.

declare module "@/platform/auth/policy-registry.js" {
  interface PolicyMap {
    billing: {
      read: PolicyRegistry.CheckFor<"billing", "read">;
      update: PolicyRegistry.CheckFor<"billing", "update">;
    };
  }
}

export const BillingResource = "billing" as const;

export const billingPolicies: PolicyRegistry.PolicyContribution = {
  billing: {
    read: Check.any(SuperAdminOnly, IsBillingOrgMember),
    update: Check.any(SuperAdminOnly, IsBillingOrgAdmin),
  },
};
