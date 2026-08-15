import { Check, type CheckFor, type PolicyContribution } from "@org/authz";
import { QueryBus } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { PlatformRoles } from "@/modules/organization/domain/ports/acl/platform-roles.acl.js";
import { PlatformRolesLive } from "@/modules/organization/infrastructure/acl/platform-roles.acl-live.js";
import { FindMembershipQuery } from "@/modules/organization/queries/find-membership.policy-query.js";
import { type OrganizationAuthzView } from "@/modules/organization/queries/find-organization-by-id.query.js";
import { FindUserOrganizationRolesQuery } from "@/modules/organization/queries/find-user-organization-roles.policy-query.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { makeIsMember, type UserOrganizationLookup } from "./is-member.policy.js";
import { makeIsOrgAdmin } from "./is-org-admin.policy.js";
import { makeIsOrgSuperAdmin } from "./is-org-super-admin.policy.js";

// Two resources, split by whether the operation names an organization:
//
//   - `organization` is scoped by OrganizationId. `read` lets any member view
//     the roster; `update` (invite, revoke, remove-member, promote, demote)
//     requires the `admin` OrganizationRole — the creator is auto-granted it at
//     create time; `delete` stays super-admin-only because tombstoning an org is
//     a platform-level operation.
//
//   - `organizationCollection` is unscoped — the super-admin listing of every
//     org names no organization, so there is nothing to resolve and no id to
//     pass. Being unscoped is what lets its check be the super-admin check alone
//     instead of a member check defending against a missing resource.

// The org role that confers authority over an organization. Kept here beside the
// policy it gates rather than in the check, so the check stays a question.
const ORG_ADMIN_ROLE = "admin";

declare module "@org/authz/resource-resolver-registry" {
  interface ResourceResolverMap {
    organization: { resourceType: OrganizationAuthzView; idType: OrganizationId };
  }
}

declare module "@org/authz/policy-registry" {
  interface PolicyMap {
    organization: {
      read: CheckFor<"organization">;
      update: CheckFor<"organization">;
      delete: CheckFor<"organization">;
    };
    organizationCollection: {
      read: CheckFor<"organizationCollection">;
    };
  }
}

export const OrganizationResource = "organization" as const;
export const OrganizationCollectionResource = "organizationCollection" as const;

// Effectful because its checks close over their data sources, which makes every
// registered check `R = never`. Super-admin comes from the role module through
// this module's ACL port; membership and org roles are this module's own data, so
// they are its own policy-queries dispatched through the bus.
export class OrganizationPolicyContribution extends Context.Service<
  OrganizationPolicyContribution,
  PolicyContribution
>()("OrganizationPolicyContribution") {}

export const OrganizationPoliciesLive = Layer.effect(
  OrganizationPolicyContribution,
  Effect.gen(function* () {
    const roles = yield* PlatformRoles;
    const queryBus = yield* QueryBus;

    const isMember: UserOrganizationLookup = (userId, organizationId) =>
      queryBus
        .execute(FindMembershipQuery, { userId, organizationId })
        .pipe(Effect.map((result) => result.isMember));

    const isOrgAdmin: UserOrganizationLookup = (userId, organizationId) =>
      queryBus
        .execute(FindUserOrganizationRolesQuery, { userId, organizationId })
        .pipe(Effect.map((result) => result.roles.includes(ORG_ADMIN_ROLE)));

    const superAdmin = makeIsOrgSuperAdmin(roles);

    return {
      organization: {
        read: Check.any(superAdmin, makeIsMember(isMember)),
        update: Check.any(superAdmin, makeIsOrgAdmin(isOrgAdmin)),
        delete: superAdmin,
      },
      organizationCollection: {
        read: superAdmin,
      },
    };
  }),
).pipe(Layer.provide(PlatformRolesLive));
