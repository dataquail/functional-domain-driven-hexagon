import { OrganizationContract } from "@org/contracts/api/Contracts";
import { QueryBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { OrganizationCollectionResource } from "@/modules/organization/policies/organization.policies.js";
import {
  FindAllOrganizationsQuery,
  type FindAllOrganizationsResult,
  type FindAllOrganizationsView,
} from "@/modules/organization/queries/find-all-organizations.query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

const toOrganizationContract = (
  view: FindAllOrganizationsView,
): OrganizationContract.Organization =>
  new OrganizationContract.Organization({
    id: view.id,
    name: view.name,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    deletedAt: view.deletedAt,
  });

const toPaginatedContract = (
  result: FindAllOrganizationsResult,
): OrganizationContract.PaginatedOrganizations =>
  new OrganizationContract.PaginatedOrganizations({
    organizations: result.organizations.map(toOrganizationContract),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  });

export const findAllEndpoint = Effect.fn("OrganizationAdminLive.findAll")(function* (
  request: EndpointRequest<typeof OrganizationContract.AdminGroup, "findAll">,
) {
  yield* Authz.hasPermissions(OrganizationCollectionResource, Actions.Read);
  const queryBus = yield* QueryBus;
  const result = yield* queryBus.execute(FindAllOrganizationsQuery, {
    page: request.query.page,
    pageSize: request.query.pageSize,
    includeDeleted: request.query.includeDeleted === "true",
  });
  return toPaginatedContract(result);
}, recoverPersistenceUnavailable);
