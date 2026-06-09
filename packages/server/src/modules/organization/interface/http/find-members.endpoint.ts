import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { OrganizationResource } from "@/modules/organization/policies/organization-policies.js";
import { FindOrganizationMembershipsQuery } from "@/modules/organization/queries/find-organization-memberships-query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Super-admin only. Lists the members of one org, enriched with each
// user's email. The cross-module orchestration (membership +
// `UsersLookup`) lives inside the query handler; this endpoint stays a
// thin dispatch — outbound ports are private to use cases.
export const findMembersEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.AdminGroup, "findMembers">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Read, request.path.orgId).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.fail(
          new OrganizationContract.OrganizationNotFoundError({
            organizationId: request.path.orgId,
            message: `Organization ${request.path.orgId} not found`,
          }),
        ),
      ),
    );

    const queryBus = yield* QueryBus;
    const members = yield* queryBus.execute(
      FindOrganizationMembershipsQuery.make({ organizationId: request.path.orgId }),
    );

    return new OrganizationContract.OrganizationMembersResponse({
      members: members.map(
        (m) =>
          new OrganizationContract.OrganizationMember({
            userId: m.userId,
            email: m.email,
            joinedAt: m.joinedAt,
          }),
      ),
    });
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("OrganizationAdminLive.findMembers"));
