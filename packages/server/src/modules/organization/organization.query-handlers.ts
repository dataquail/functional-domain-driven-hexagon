import { Query } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { UsersLookupLive } from "@/modules/organization/infrastructure/acl/users-lookup.acl-live.js";
import { findAllOrganizationsHandler } from "@/modules/organization/queries/find-all-organizations.handler.js";
import { FindAllOrganizationsQuery } from "@/modules/organization/queries/find-all-organizations.query.js";
import { findMembershipHandler } from "@/modules/organization/queries/find-membership.handler.js";
import { FindMembershipQuery } from "@/modules/organization/queries/find-membership.policy-query.js";
import { findMyOrganizationsHandler } from "@/modules/organization/queries/find-my-organizations.handler.js";
import { FindMyOrganizationsQuery } from "@/modules/organization/queries/find-my-organizations.query.js";
import { findOrganizationByIdHandler } from "@/modules/organization/queries/find-organization-by-id.handler.js";
import { FindOrganizationByIdQuery } from "@/modules/organization/queries/find-organization-by-id.query.js";
import { findOrganizationMembershipsHandler } from "@/modules/organization/queries/find-organization-memberships.handler.js";
import { FindOrganizationMembershipsQuery } from "@/modules/organization/queries/find-organization-memberships.query.js";
import { findPendingInvitationsHandler } from "@/modules/organization/queries/find-pending-invitations.handler.js";
import { FindPendingInvitationsQuery } from "@/modules/organization/queries/find-pending-invitations.query.js";
import { findUserOrganizationRolesHandler } from "@/modules/organization/queries/find-user-organization-roles.handler.js";
import { FindUserOrganizationRolesQuery } from "@/modules/organization/queries/find-user-organization-roles.policy-query.js";

// Every handler here reads SQL directly, so none needs a wrap.
// `UsersLookupLive` is provided here rather than at the composition root: only a dispatch
// surface can absorb its own outbound adapter, because `handlersOf` infers the user-module
// requirement it carries where a hand-written output type would force this module to name
// it.
export const organizationQueryGroup = Query.group(
  FindMembershipQuery,
  FindOrganizationMembershipsQuery,
  FindAllOrganizationsQuery,
  FindMyOrganizationsQuery,
  FindOrganizationByIdQuery,
  FindPendingInvitationsQuery,
  FindUserOrganizationRolesQuery,
);

const OrganizationQueryHandlersLive = Query.handlersOf(organizationQueryGroup, {
  FindMembershipQuery: (payload) => findMembershipHandler(payload),
  FindOrganizationMembershipsQuery: (payload) => findOrganizationMembershipsHandler(payload),
  FindAllOrganizationsQuery: (payload) => findAllOrganizationsHandler(payload),
  FindMyOrganizationsQuery: (payload) => findMyOrganizationsHandler(payload),
  FindOrganizationByIdQuery: (payload) => findOrganizationByIdHandler(payload),
  FindPendingInvitationsQuery: (payload) => findPendingInvitationsHandler(payload),
  FindUserOrganizationRolesQuery: (payload) => findUserOrganizationRolesHandler(payload),
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
