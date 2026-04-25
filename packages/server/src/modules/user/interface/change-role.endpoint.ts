import { ChangeUserRoleCommand } from "@/modules/user/commands/change-user-role-command.js";
import { CommandBus } from "@/platform/command-bus.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";
import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

export const changeRoleEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "changeRole">,
) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      ChangeUserRoleCommand.make({
        userId: request.path.id,
        role: request.payload.role,
      }),
    );
  }).pipe(
    Effect.catchTag("UserNotFound", (err) =>
      Effect.fail(
        new UserContract.UserNotFoundError({
          userId: err.userId,
          message: `User ${err.userId} not found`,
        }),
      ),
    ),
    Effect.withSpan("UserHttpLive.changeRole"),
  );
