import { AuthContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { RoleService } from "@/platform/ddd/role-service.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const meEndpoint = (_request: EndpointRequest<typeof AuthContract.PrivateGroup, "me">) =>
  Effect.gen(function* () {
    const user = yield* CurrentUser;
    const roles = yield* RoleService;
    const perms = yield* roles.findPlatformPermissions(user.userId);
    return new AuthContract.CurrentUserResponse({
      userId: user.userId,
      isSuperAdmin: perms.roles.includes("super_admin"),
    });
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("AuthLive.me"));
