import { Database } from "@org/database/index";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { PlatformRoles } from "@/modules/organization/domain/ports/acl/platform-roles.acl.js";
import { PlatformRolesLive } from "@/modules/organization/infrastructure/acl/platform-roles.acl-live.js";
import { FindMembershipQuery } from "@/modules/organization/queries/find-membership.policy-query.js";
import { type OrganizationAuthzView } from "@/modules/organization/queries/find-organization-by-id.query.js";
import { FindUserOrganizationRolesQuery } from "@/modules/organization/queries/find-user-organization-roles.policy-query.js";
import * as Check from "@/platform/auth/check.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
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

declare module "@/platform/auth/resource-resolver-registry.js" {
  interface ResourceResolverMap {
    organization: { resourceType: OrganizationAuthzView; idType: OrganizationId };
  }
}

declare module "@/platform/auth/policy-registry.js" {
  interface PolicyMap {
    organization: {
      read: PolicyRegistry.CheckFor<"organization">;
      update: PolicyRegistry.CheckFor<"organization">;
      delete: PolicyRegistry.CheckFor<"organization">;
    };
    organizationCollection: {
      read: PolicyRegistry.CheckFor<"organizationCollection">;
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
  PolicyRegistry.PolicyContribution
>()("OrganizationPolicyContribution") {}

export const OrganizationPoliciesLive = Layer.effect(
  OrganizationPolicyContribution,
  Effect.gen(function* () {
    const roles = yield* PlatformRoles;
    const queryBus = yield* QueryBus;
    // The query handlers pull `Database` through the dispatch, so it is captured
    // once here and re-provided, keeping each check's requirements empty.
    const db = yield* Database.Database;

    const isMember: UserOrganizationLookup = (userId, organizationId) =>
      queryBus.execute(FindMembershipQuery.make({ userId, organizationId })).pipe(
        Effect.provideService(Database.Database, db),
        Effect.map((result) => result.isMember),
      );

    const isOrgAdmin: UserOrganizationLookup = (userId, organizationId) =>
      queryBus.execute(FindUserOrganizationRolesQuery.make({ userId, organizationId })).pipe(
        Effect.provideService(Database.Database, db),
        Effect.map((result) => result.roles.includes(ORG_ADMIN_ROLE)),
      );

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
