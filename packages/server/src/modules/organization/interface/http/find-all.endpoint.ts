import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { OrganizationResource } from "@/modules/organization/policies/organization-policies.js";
import {
  FindAllOrganizationsQuery,
  type FindAllOrganizationsResult,
  type FindAllOrganizationsView,
} from "@/modules/organization/queries/find-all-organizations-query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
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

export const findAllEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.AdminGroup, "findAll">,
) =>
  Effect.gen(function* () {
    // Flat `Read` action — no id, no resource resolver. The registered
    // policy is `SuperAdminOnly`; members get a 403 before the query
    // fires. `Authz.hasPermissions` declares `NotFound` in its error
    // channel for resource-scoped calls; with no id passed it can't
    // surface, so we collapse it to a defect at the boundary.
    yield* Authz.hasPermissions(OrganizationResource, Actions.Read).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.die("Unreachable: flat Authz.hasPermissions cannot surface NotFound"),
      ),
    );
    const queryBus = yield* QueryBus;
    const result = yield* queryBus.execute(
      FindAllOrganizationsQuery.make({
        page: request.urlParams.page,
        pageSize: request.urlParams.pageSize,
        includeDeleted: request.urlParams.includeDeleted === "true",
      }),
    );
    return toPaginatedContract(result);
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("OrganizationAdminLive.findAll"));
