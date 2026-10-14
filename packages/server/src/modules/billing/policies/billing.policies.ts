import { Check, type CheckFor, type PolicyContribution } from "@effect-server-utils/authz";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.ts";
import { PlatformRoles } from "@/modules/billing/domain/ports/acl/platform-roles.acl.ts";
import { OrganizationAccessLive } from "@/modules/billing/infrastructure/acl/organization-access.acl-live.ts";
import { PlatformRolesLive } from "@/modules/billing/infrastructure/acl/platform-roles.acl-live.ts";

import { isBillingOrgAdminCheck } from "./is-billing-org-admin.policy.ts";
import { isBillingOrgMemberCheck } from "./is-billing-org-member.policy.ts";
import { isBillingSuperAdminCheck } from "./is-billing-super-admin.policy.ts";

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

declare module "@effect-server-utils/authz/policy-registry" {
  interface PolicyMap {
    billing: {
      read: CheckFor<"billing">;
      update: CheckFor<"billing">;
    };
  }
}

export const BillingResource = "billing" as const;

// Effectful because its checks close over this module's own ACL ports, which
// makes every registered check `R = never`.
export class BillingPolicyContribution extends Context.Service<
  BillingPolicyContribution,
  PolicyContribution
>()("BillingPolicyContribution") {}

export const BillingPoliciesLive = Layer.effect(
  BillingPolicyContribution,
  Effect.gen(function* () {
    const roles = yield* PlatformRoles;
    const organizations = yield* OrganizationAccess;
    const superAdmin = isBillingSuperAdminCheck(roles);

    return BillingPolicyContribution.of({
      billing: {
        read: Check.any(superAdmin, isBillingOrgMemberCheck(organizations)),
        update: Check.any(superAdmin, isBillingOrgAdminCheck(organizations)),
      },
    });
  }),
).pipe(Layer.provide([PlatformRolesLive, OrganizationAccessLive]));
