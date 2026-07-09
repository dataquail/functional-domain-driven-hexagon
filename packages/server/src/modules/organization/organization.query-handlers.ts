import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UsersLookupLive } from "@/modules/organization/infrastructure/acl/users-lookup.acl-live.js";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/repositories/invitation.repository-live.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { findAllOrganizations } from "@/modules/organization/queries/find-all-organizations.handler.js";
import { findAllOrganizationsQuerySpanAttributes } from "@/modules/organization/queries/find-all-organizations.query.js";
import { findMembership } from "@/modules/organization/queries/find-membership.handler.js";
import {
  type FindMembershipQuery,
  findMembershipQuerySpanAttributes,
  type FindMembershipResult,
} from "@/modules/organization/queries/find-membership.query.js";
import { findMyOrganizations } from "@/modules/organization/queries/find-my-organizations.handler.js";
import { findMyOrganizationsQuerySpanAttributes } from "@/modules/organization/queries/find-my-organizations.query.js";
import { findOrganizationMemberships } from "@/modules/organization/queries/find-organization-memberships.handler.js";
import {
  type FindOrganizationMembershipsQuery,
  findOrganizationMembershipsQuerySpanAttributes,
  type OrganizationMemberView,
} from "@/modules/organization/queries/find-organization-memberships.query.js";
import { findPendingInvitations } from "@/modules/organization/queries/find-pending-invitations.handler.js";
import {
  type FindPendingInvitationsQuery,
  findPendingInvitationsQuerySpanAttributes,
  type PendingInvitationView,
} from "@/modules/organization/queries/find-pending-invitations.query.js";
import { findUserOrganizationRoles } from "@/modules/organization/queries/find-user-organization-roles.handler.js";
import {
  type FindUserOrganizationRolesQuery,
  findUserOrganizationRolesQuerySpanAttributes,
  type FindUserOrganizationRolesResult,
} from "@/modules/organization/queries/find-user-organization-roles.query.js";
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

type FindPendingInvitationsBusOutput = Effect.Effect<
  ReadonlyArray<PendingInvitationView>,
  PersistenceUnavailable,
  Database.Database
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
    FindPendingInvitationsQuery: {
      readonly query: FindPendingInvitationsQuery;
      readonly output: FindPendingInvitationsBusOutput;
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
        Effect.provide(
          Layer.mergeAll(
            MembershipRepositoryLive,
            UsersLookupLive,
            OrganizationRolesRepositoryLive,
          ),
        ),
      ),
    spanAttributes: findOrganizationMembershipsQuerySpanAttributes,
  },
  FindPendingInvitationsQuery: {
    handle: (q): FindPendingInvitationsBusOutput =>
      findPendingInvitations(q).pipe(Effect.provide(InvitationRepositoryLive)),
    spanAttributes: findPendingInvitationsQuerySpanAttributes,
  },
});
