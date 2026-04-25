import { CreateUserCommand } from "@/modules/user/commands/create-user-command.js";
import { CommandBus } from "@/platform/command-bus.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";
import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

export const createEndpoint = (request: EndpointRequest<typeof UserContract.Group, "create">) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    const id = yield* commandBus.execute(
      CreateUserCommand.make({
        email: request.payload.email,
        country: request.payload.country,
        street: request.payload.street,
        postalCode: request.payload.postalCode,
      }),
    );
    return new UserContract.CreateUserResponse({ id });
  }).pipe(
    Effect.catchTag("UserAlreadyExists", (err) =>
      Effect.fail(
        new UserContract.UserAlreadyExistsError({
          email: err.email,
          message: `A user with email ${err.email} already exists`,
        }),
      ),
    ),
    Effect.withSpan("UserHttpLive.create"),
  );
