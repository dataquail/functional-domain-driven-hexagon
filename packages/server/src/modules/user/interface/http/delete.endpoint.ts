import { DeleteUserCommand } from "@/modules/user/commands/delete-user-command.js";
import { CommandBus } from "@/platform/command-bus.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";
import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

export const deleteEndpoint = (request: EndpointRequest<typeof UserContract.Group, "delete">) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(DeleteUserCommand.make({ userId: request.path.id }));
  }).pipe(
    Effect.catchTag("UserNotFound", (err) =>
      Effect.fail(
        new UserContract.UserNotFoundError({
          userId: err.userId,
          message: `User ${err.userId} not found`,
        }),
      ),
    ),
    Effect.withSpan("UserLive.delete"),
  );
