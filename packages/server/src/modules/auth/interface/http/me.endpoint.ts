import { AuthContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { RoleService } from "@/platform/ddd/ports/role-service.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const meEndpoint = Effect.fn("AuthLive.me")(function* (
  _request: EndpointRequest<typeof AuthContract.PrivateGroup, "me">,
) {
  const user = yield* CurrentUser;
  const roles = yield* RoleService;
  const perms = yield* roles.findPlatformPermissions(user.userId);
  return new AuthContract.CurrentUserResponse({
    userId: user.userId,
    isSuperAdmin: perms.roles.includes("super_admin"),
  });
}, recoverPersistenceUnavailable);
