import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import {
  FindMyOrganizationsQuery,
  type FindMyOrganizationsView,
} from "@/modules/organization/queries/find-my-organizations-query.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

const toContract = (view: FindMyOrganizationsView): OrganizationContract.Organization =>
  new OrganizationContract.Organization({
    id: view.id,
    name: view.name,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    deletedAt: null,
  });

// Authenticated, no `Authz.hasPermissions` gate — the query filters by
// `CurrentUser.userId` server-side, so the caller can only see their
// own memberships. Used by the frontend to resolve "which org am I in"
// until the route reshape (Phase 8) puts orgId in the URL.
export const findMineEndpoint = (
  _request: EndpointRequest<typeof OrganizationContract.Group, "findMine">,
) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentUser;
    const queryBus = yield* QueryBus;
    const result = yield* queryBus.execute(
      FindMyOrganizationsQuery.make({ userId: currentUser.userId }),
    );
    return result.organizations.map(toContract);
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("OrganizationLive.findMine"));
