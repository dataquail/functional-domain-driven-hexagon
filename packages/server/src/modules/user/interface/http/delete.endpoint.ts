import { CommandBus } from "@effect-server-utils/cqrs";
import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import {
  type EndpointRequest,
  recoverPersistenceUnavailable,
} from "@/globals/infrastructure/framework/http/http-endpoint";
import { DeleteUserCommand } from "@/modules/user/commands/delete-user.command";

export const deleteEndpoint = Effect.fn("UserLive.delete")(
  function* (request: EndpointRequest<typeof UserContract.Group, "delete">) {
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(DeleteUserCommand, { userId: request.params.id });
  },
  Effect.catchTag(
    "UserNotFound",
    (err) =>
      new UserContract.UserNotFoundError({
        userId: err.userId,
        message: `User ${err.userId} not found`,
      }),
  ),
  recoverPersistenceUnavailable,
);
