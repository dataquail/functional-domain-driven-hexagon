import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { DeleteUserCommand } from "@/modules/user/commands/delete-user.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const deleteEndpoint = (request: EndpointRequest<typeof UserContract.Group, "delete">) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(DeleteUserCommand.make({ userId: request.params.id }));
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
    Effect.withSpan("UserLive.delete"),
  );
