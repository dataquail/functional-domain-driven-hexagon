import { UserContract } from "@org/contracts/api/Contracts";
import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { DeleteUser } from "@/modules/user/commands/delete-user.command.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const deleteEndpoint = Effect.fn("UserLive.delete")(
  function* (request: EndpointRequest<typeof UserContract.Group, "delete">) {
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(DeleteUser, { userId: request.params.id });
  },
  Effect.catchTag("UserNotFound", (err) =>
    Effect.fail(
      new UserContract.UserNotFoundError({
        userId: err.userId,
        message: `User ${err.userId} not found`,
      }),
    ),
  ),
  recoverPersistenceUnavailable,
);
