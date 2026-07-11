import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { UsersLookupLive } from "@/modules/organization/infrastructure/acl/users-lookup.acl-live.js";
import { findAllOrganizations } from "@/modules/organization/queries/find-all-organizations.handler.js";
import {
  type FindAllOrganizationsQuery,
  findAllOrganizationsQuerySpanAttributes,
  type FindAllOrganizationsResult,
} from "@/modules/organization/queries/find-all-organizations.query.js";
import { findMembership } from "@/modules/organization/queries/find-membership.handler.js";
import {
  type FindMembershipQuery,
  findMembershipQuerySpanAttributes,
  type FindMembershipResult,
} from "@/modules/organization/queries/find-membership.query.js";
import { findMyOrganizations } from "@/modules/organization/queries/find-my-organizations.handler.js";
import {
  type FindMyOrganizationsQuery,
  findMyOrganizationsQuerySpanAttributes,
  type FindMyOrganizationsResult,
} from "@/modules/organization/queries/find-my-organizations.query.js";
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

type FindAllOrganizationsOutput = Effect.Effect<
  FindAllOrganizationsResult,
  PersistenceUnavailable,
  Database.Database
>;

type FindMyOrganizationsOutput = Effect.Effect<
  FindMyOrganizationsResult,
  PersistenceUnavailable,
  Database.Database
>;

type FindUserOrganizationRolesOutput = Effect.Effect<
  FindUserOrganizationRolesResult,
  PersistenceUnavailable,
  Database.Database
>;

type FindMembershipOutput = Effect.Effect<
  FindMembershipResult,
  PersistenceUnavailable,
  Database.Database
>;

// `QueryBus` stays in R because `UsersLookupLive` (the outbound
// adapter that discharges `UsersLookup` here) uses the bus to
// dispatch the user-module's `FindUsersByIdsQuery`. The bus is
// provided at the composition root.
type FindOrganizationMembershipsOutput = Effect.Effect<
  ReadonlyArray<OrganizationMemberView>,
  PersistenceUnavailable,
  Database.Database | QueryBus
>;

type FindPendingInvitationsOutput = Effect.Effect<
  ReadonlyArray<PendingInvitationView>,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindAllOrganizationsQuery: {
      readonly query: FindAllOrganizationsQuery;
      readonly output: FindAllOrganizationsOutput;
    };
    FindMyOrganizationsQuery: {
      readonly query: FindMyOrganizationsQuery;
      readonly output: FindMyOrganizationsOutput;
    };
    FindUserOrganizationRolesQuery: {
      readonly query: FindUserOrganizationRolesQuery;
      readonly output: FindUserOrganizationRolesOutput;
    };
    FindMembershipQuery: {
      readonly query: FindMembershipQuery;
      readonly output: FindMembershipOutput;
    };
    FindOrganizationMembershipsQuery: {
      readonly query: FindOrganizationMembershipsQuery;
      readonly output: FindOrganizationMembershipsOutput;
    };
    FindPendingInvitationsQuery: {
      readonly query: FindPendingInvitationsQuery;
      readonly output: FindPendingInvitationsOutput;
    };
  }
}

// Every handler here reads SQL directly, so none needs a repository
// wrap. `FindOrganizationMembershipsQuery` is the exception: it still
// discharges `UsersLookup` (the cross-module email ACL) before the bus
// dispatch, leaving `Database | QueryBus` in R.
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
    handle: findUserOrganizationRoles,
    spanAttributes: findUserOrganizationRolesQuerySpanAttributes,
  },
  FindMembershipQuery: {
    handle: findMembership,
    spanAttributes: findMembershipQuerySpanAttributes,
  },
  FindOrganizationMembershipsQuery: {
    handle: (q): FindOrganizationMembershipsOutput =>
      findOrganizationMemberships(q).pipe(Effect.provide(UsersLookupLive)),
    spanAttributes: findOrganizationMembershipsQuerySpanAttributes,
  },
  FindPendingInvitationsQuery: {
    handle: findPendingInvitations,
    spanAttributes: findPendingInvitationsQuerySpanAttributes,
  },
});
