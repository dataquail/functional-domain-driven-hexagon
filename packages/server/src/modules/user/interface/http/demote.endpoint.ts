import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { RevokeRoleCommand } from "@/modules/role/index.js";
import { UserResource } from "@/modules/user/policies/user-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const demoteEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "demoteFromSuperAdmin">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      RevokeRoleCommand.make({ userId: request.path.id, role: "super_admin" }),
    );
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new UserContract.UserNotFoundError({
          userId: request.path.id,
          message: `User ${request.path.id} not found`,
        }),
      ),
    ),
    // Idempotency: revoking a role the user never held isn't an error.
    // The desired state is "user is not super admin", which holds.
    Effect.catchTag("DoesNotHaveRole", () => Effect.void),
    recoverPersistenceUnavailable,
    Effect.withSpan("UserLive.demoteFromSuperAdmin"),
  );
