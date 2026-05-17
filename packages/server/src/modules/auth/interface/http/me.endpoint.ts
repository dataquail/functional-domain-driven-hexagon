import { AuthContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { type EndpointRequest } from "@/platform/http-endpoint.js";

export const meEndpoint = (_request: EndpointRequest<typeof AuthContract.PrivateGroup, "me">) =>
  Effect.gen(function* () {
    const user = yield* CurrentUser;
    return new AuthContract.CurrentUserResponse({
      userId: user.userId,
      permissions: Array.from(user.permissions),
    });
  }).pipe(Effect.withSpan("AuthLive.me"));
