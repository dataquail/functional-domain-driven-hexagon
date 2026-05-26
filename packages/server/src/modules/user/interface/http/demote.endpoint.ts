import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { RoleManagement } from "@/modules/user/domain/ports/external/role-management.js";
import { UserResource } from "@/modules/user/policies/user-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const demoteEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "demoteFromSuperAdmin">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
    const roleManagement = yield* RoleManagement;
    // The port is idempotent — revoking a role never held succeeds — so
    // the endpoint no longer absorbs a "does not have role" case here.
    yield* roleManagement.revokeSuperAdmin({ userId: request.path.id });
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new UserContract.UserNotFoundError({
          userId: request.path.id,
          message: `User ${request.path.id} not found`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("UserLive.demoteFromSuperAdmin"),
  );
