import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { DemoteFromSuperAdminCommand } from "@/modules/user/commands/demote-from-super-admin-command.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const demoteEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "demoteFromSuperAdmin">,
) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(DemoteFromSuperAdminCommand.make({ userId: request.path.id }));
  }).pipe(
    Effect.catchTag("UserNotFound", (err) =>
      Effect.fail(
        new UserContract.UserNotFoundError({
          userId: err.userId,
          message: `User ${err.userId} not found`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("UserLive.demoteFromSuperAdmin"),
  );
