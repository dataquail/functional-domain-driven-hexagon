import { QueryBus } from "@effect-server-utils/cqrs";
import { CliOrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import {
  type EndpointRequest,
  recoverPersistenceUnavailable,
} from "@/globals/infrastructure/framework/http/http-endpoint.js";
import {
  FindMyOrganizationsQuery,
  type FindMyOrganizationsView,
} from "@/modules/organization/queries/find-my-organizations.query.js";

const toCli = (view: FindMyOrganizationsView): CliOrganizationContract.CliOrganization =>
  new CliOrganizationContract.CliOrganization({
    id: view.id,
    name: view.name,
    isAdmin: view.isAdmin,
  });

// CLI adapter (ADR-0005): same `FindMyOrganizationsQuery` as the GUI's
// findMine (filters by CurrentUser server-side), mapped to the leaner
// `CliOrganization` shape.
export const findMineEndpoint = Effect.fn("CliOrganizationLive.listMine")(function* (
  _request: EndpointRequest<typeof CliOrganizationContract.Group, "listMine">,
) {
  const currentUser = yield* CurrentUser;
  const queryBus = yield* QueryBus;
  const result = yield* queryBus.execute(FindMyOrganizationsQuery, { userId: currentUser.userId });
  return result.organizations.map(toCli);
}, recoverPersistenceUnavailable);
