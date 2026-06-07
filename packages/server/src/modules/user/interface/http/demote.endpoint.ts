import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { DemoteFromSuperAdminCommand } from "@/modules/user/commands/demote-from-super-admin-command.js";
import { UserResource } from "@/modules/user/policies/user-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const demoteEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "demoteFromSuperAdmin">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(DemoteFromSuperAdminCommand.make({ userId: request.path.id }));
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
