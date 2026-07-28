import { Query } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { UsersLookupLive } from "@/modules/organization/infrastructure/acl/users-lookup.acl-live.js";
import { findAllOrganizations } from "@/modules/organization/queries/find-all-organizations.handler.js";
import { FindAllOrganizations } from "@/modules/organization/queries/find-all-organizations.query.js";
import { findMembership } from "@/modules/organization/queries/find-membership.handler.js";
import { FindMembership } from "@/modules/organization/queries/find-membership.policy-query.js";
import { findMyOrganizations } from "@/modules/organization/queries/find-my-organizations.handler.js";
import { FindMyOrganizations } from "@/modules/organization/queries/find-my-organizations.query.js";
import { findOrganizationById } from "@/modules/organization/queries/find-organization-by-id.handler.js";
import { FindOrganizationById } from "@/modules/organization/queries/find-organization-by-id.query.js";
import { findOrganizationMemberships } from "@/modules/organization/queries/find-organization-memberships.handler.js";
import { FindOrganizationMemberships } from "@/modules/organization/queries/find-organization-memberships.query.js";
import { findPendingInvitations } from "@/modules/organization/queries/find-pending-invitations.handler.js";
import { FindPendingInvitations } from "@/modules/organization/queries/find-pending-invitations.query.js";
import { findUserOrganizationRoles } from "@/modules/organization/queries/find-user-organization-roles.handler.js";
import { FindUserOrganizationRoles } from "@/modules/organization/queries/find-user-organization-roles.policy-query.js";

// Every handler here reads SQL directly, so none needs a wrap.
// `UsersLookupLive` is provided here rather than at the composition root: only a dispatch
// surface can absorb its own outbound adapter, because `handlersOf` infers the user-module
// requirement it carries where a hand-written output type would force this module to name
// it.
const organizationQueryGroup = Query.group(
  FindMembership,
  FindOrganizationMemberships,
  FindAllOrganizations,
  FindMyOrganizations,
  FindOrganizationById,
  FindPendingInvitations,
  FindUserOrganizationRoles,
);

const OrganizationQueryHandlersLive = Query.handlersOf(organizationQueryGroup, {
  FindMembershipQuery: (payload) => findMembership(payload),
  FindOrganizationMembershipsQuery: (payload) => findOrganizationMemberships(payload),
  FindAllOrganizationsQuery: (payload) => findAllOrganizations(payload),
  FindMyOrganizationsQuery: (payload) => findMyOrganizations(payload),
  FindOrganizationByIdQuery: (payload) => findOrganizationById(payload),
  FindPendingInvitationsQuery: (payload) => findPendingInvitations(payload),
  FindUserOrganizationRolesQuery: (payload) => findUserOrganizationRoles(payload),
}).pipe(Layer.provide(UsersLookupLive));

const organizationQuerySpanAttributes: Query.SpanAttributes<typeof organizationQueryGroup> = {
  FindMembershipQuery: (payload) => ({
    "query.userId": payload.userId,
    "query.organizationId": payload.organizationId,
  }),
  FindOrganizationMembershipsQuery: (payload) => ({
    "organization.id": payload.organizationId,
  }),
  FindAllOrganizationsQuery: (payload) => ({
    "query.page": payload.page,
    "query.pageSize": payload.pageSize,
    "query.includeDeleted": payload.includeDeleted,
  }),
  FindMyOrganizationsQuery: (payload) => ({ "query.userId": payload.userId }),
  FindOrganizationByIdQuery: (payload) => ({
    "query.organizationId": payload.organizationId,
  }),
  FindPendingInvitationsQuery: (payload) => ({ "organization.id": payload.organizationId }),
  FindUserOrganizationRolesQuery: (payload) => ({
    "query.userId": payload.userId,
    "query.organizationId": payload.organizationId,
  }),
};

// This module's slice of the read-side dispatch surface. See `WalletCommands` for why
// a module publishes its own surface rather than letting consumers name the bus.
export class OrganizationQueries extends Context.Service<
  OrganizationQueries,
  Query.Dispatcher<typeof organizationQueryGroup>
>()("@org/server/organization/OrganizationQueries") {}

export const OrganizationQueriesLive = Layer.effect(
  OrganizationQueries,
  Query.dispatcher(organizationQueryGroup, { spanAttributes: organizationQuerySpanAttributes }),
).pipe(Layer.provide(OrganizationQueryHandlersLive));
