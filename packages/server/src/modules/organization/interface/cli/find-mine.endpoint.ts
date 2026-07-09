import { CliOrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import {
  FindMyOrganizationsQuery,
  type FindMyOrganizationsView,
} from "@/modules/organization/queries/find-my-organizations.query.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

const toCli = (view: FindMyOrganizationsView): CliOrganizationContract.CliOrganization =>
  new CliOrganizationContract.CliOrganization({
    id: view.id,
    name: view.name,
    isAdmin: view.isAdmin,
  });

// CLI adapter (ADR-0024): same `FindMyOrganizationsQuery` as the GUI's
// findMine (filters by CurrentUser server-side), mapped to the leaner
// `CliOrganization` shape.
export const findMineEndpoint = Effect.fn("CliOrganizationLive.listMine")(function* (
  _request: EndpointRequest<typeof CliOrganizationContract.Group, "listMine">,
) {
  const currentUser = yield* CurrentUser;
  const queryBus = yield* QueryBus;
  const result = yield* queryBus.execute(
    FindMyOrganizationsQuery.make({ userId: currentUser.userId }),
  );
  return result.organizations.map(toCli);
}, recoverPersistenceUnavailable);
