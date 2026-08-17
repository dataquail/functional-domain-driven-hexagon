import { QueryBus } from "@effect-server-utils/cqrs";
import { AuthContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { FindCurrentUserQuery } from "@/modules/auth/queries/find-current-user.query.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const meEndpoint = Effect.fn("AuthLive.me")(function* (
  _request: EndpointRequest<typeof AuthContract.PrivateGroup, "me">,
) {
  const user = yield* CurrentUser;
  const queryBus = yield* QueryBus;
  const view = yield* queryBus.execute(FindCurrentUserQuery, { userId: user.userId });
  return new AuthContract.CurrentUserResponse({
    userId: view.userId,
    isSuperAdmin: view.isSuperAdmin,
  });
}, recoverPersistenceUnavailable);
