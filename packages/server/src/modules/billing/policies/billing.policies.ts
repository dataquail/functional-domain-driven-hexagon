import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import { PlatformRoles } from "@/modules/billing/domain/ports/acl/platform-roles.acl.js";
import { OrganizationAccessLive } from "@/modules/billing/infrastructure/acl/organization-access.acl-live.js";
import { PlatformRolesLive } from "@/modules/billing/infrastructure/acl/platform-roles.acl-live.js";
import * as Check from "@/platform/auth/check.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";

import { makeIsBillingOrgAdmin } from "./is-billing-org-admin.policy.js";
import { makeIsBillingOrgMember } from "./is-billing-org-member.policy.js";
import { makeIsBillingSuperAdmin } from "./is-billing-super-admin.policy.js";

// Billing's single policy resource gates two CRUD operations:
//   - `read` (GET current subscription) — every member of the org may see the
//     subscription state.
//   - `update` (POST subscribe, DELETE cancel) — only org admins may take on a
//     financial commitment. CRUD vocabulary maps both "subscribe" and "cancel"
//     to `update`; the verb-level distinction surfaces at the URL.
//
// Super-admins bypass both. The Stripe webhook endpoint is NOT covered here —
// it has no policy; authentication is by signature, verified inside the
// endpoint.

declare module "@/platform/auth/policy-registry.js" {
  interface PolicyMap {
    billing: {
      read: PolicyRegistry.CheckFor<"billing">;
      update: PolicyRegistry.CheckFor<"billing">;
    };
  }
}

export const BillingResource = "billing" as const;

// Effectful because its checks close over this module's own ACL ports, which
// makes every registered check `R = never`.
export class BillingPolicyContribution extends Context.Service<
  BillingPolicyContribution,
  PolicyRegistry.PolicyContribution
>()("BillingPolicyContribution") {}

export const BillingPoliciesLive = Layer.effect(
  BillingPolicyContribution,
  Effect.gen(function* () {
    const roles = yield* PlatformRoles;
    const organizations = yield* OrganizationAccess;
    const superAdmin = makeIsBillingSuperAdmin(roles);

    return {
      billing: {
        read: Check.any(superAdmin, makeIsBillingOrgMember(organizations)),
        update: Check.any(superAdmin, makeIsBillingOrgAdmin(organizations)),
      },
    };
  }),
).pipe(Layer.provide([PlatformRolesLive, OrganizationAccessLive]));
