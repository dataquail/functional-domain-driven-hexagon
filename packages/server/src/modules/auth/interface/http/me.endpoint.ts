import { AuthContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import { QueryBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { FindCurrentUser } from "@/modules/auth/queries/find-current-user.query.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const meEndpoint = Effect.fn("AuthLive.me")(function* (
  _request: EndpointRequest<typeof AuthContract.PrivateGroup, "me">,
) {
  const user = yield* CurrentUser;
  const queryBus = yield* QueryBus;
  const view = yield* queryBus.execute(FindCurrentUser, { userId: user.userId });
  return new AuthContract.CurrentUserResponse({
    userId: view.userId,
    isSuperAdmin: view.isSuperAdmin,
  });
}, recoverPersistenceUnavailable);
