import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { UsersLookupLive } from "@/modules/organization/infrastructure/external/users-lookup-live.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/membership-repository-live.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/organization-roles-repository-live.js";
import { findAllOrganizations } from "@/modules/organization/queries/find-all-organizations.js";
import { findAllOrganizationsQuerySpanAttributes } from "@/modules/organization/queries/find-all-organizations-query.js";
import { findMembership } from "@/modules/organization/queries/find-membership.js";
import {
  type FindMembershipQuery,
  findMembershipQuerySpanAttributes,
  type FindMembershipResult,
} from "@/modules/organization/queries/find-membership-query.js";
import { findMyOrganizations } from "@/modules/organization/queries/find-my-organizations.js";
import { findMyOrganizationsQuerySpanAttributes } from "@/modules/organization/queries/find-my-organizations-query.js";
import { findOrganizationMemberships } from "@/modules/organization/queries/find-organization-memberships.js";
import {
  type FindOrganizationMembershipsQuery,
  findOrganizationMembershipsQuerySpanAttributes,
  type OrganizationMemberView,
} from "@/modules/organization/queries/find-organization-memberships-query.js";
import { findUserOrganizationRoles } from "@/modules/organization/queries/find-user-organization-roles.js";
import {
  type FindUserOrganizationRolesQuery,
  findUserOrganizationRolesQuerySpanAttributes,
  type FindUserOrganizationRolesResult,
} from "@/modules/organization/queries/find-user-organization-roles-query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type QueryBus, queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindUserOrganizationRolesBusOutput = Effect.Effect<
  FindUserOrganizationRolesResult,
  PersistenceUnavailable,
  Database.Database
>;

type FindMembershipBusOutput = Effect.Effect<
  FindMembershipResult,
  PersistenceUnavailable,
  Database.Database
>;

// `QueryBus` stays in R because `UsersLookupLive` (the outbound
// adapter that discharges `UsersLookup` here) uses the bus to
// dispatch the user-module's `FindUsersByIdsQuery`. The bus is
// provided at the composition root.
type FindOrganizationMembershipsBusOutput = Effect.Effect<
  ReadonlyArray<OrganizationMemberView>,
  PersistenceUnavailable,
  Database.Database | QueryBus
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindUserOrganizationRolesQuery: {
      readonly query: FindUserOrganizationRolesQuery;
      readonly output: FindUserOrganizationRolesBusOutput;
    };
    FindMembershipQuery: {
      readonly query: FindMembershipQuery;
      readonly output: FindMembershipBusOutput;
    };
    FindOrganizationMembershipsQuery: {
      readonly query: FindOrganizationMembershipsQuery;
      readonly output: FindOrganizationMembershipsBusOutput;
    };
  }
}

// `FindAllOrganizationsQuery` reads SQL directly (no repository in R)
// so the handler doesn't need wrapping. `FindUserOrganizationRolesQuery`
// and `FindMembershipQuery` go through their repositories and are
// wrapped with the corresponding `*RepositoryLive` to discharge that
// dep before the bus dispatch.
export const organizationQueryHandlers = queryHandlers({
  FindAllOrganizationsQuery: {
    handle: findAllOrganizations,
    spanAttributes: findAllOrganizationsQuerySpanAttributes,
  },
  FindMyOrganizationsQuery: {
    handle: findMyOrganizations,
    spanAttributes: findMyOrganizationsQuerySpanAttributes,
  },
  FindUserOrganizationRolesQuery: {
    handle: (q): FindUserOrganizationRolesBusOutput =>
      findUserOrganizationRoles(q).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
    spanAttributes: findUserOrganizationRolesQuerySpanAttributes,
  },
  FindMembershipQuery: {
    handle: (q): FindMembershipBusOutput =>
      findMembership(q).pipe(Effect.provide(MembershipRepositoryLive)),
    spanAttributes: findMembershipQuerySpanAttributes,
  },
  FindOrganizationMembershipsQuery: {
    handle: (q): FindOrganizationMembershipsBusOutput =>
      findOrganizationMemberships(q).pipe(
        Effect.provide(MembershipRepositoryLive),
        Effect.provide(UsersLookupLive),
      ),
    spanAttributes: findOrganizationMembershipsQuerySpanAttributes,
  },
});
