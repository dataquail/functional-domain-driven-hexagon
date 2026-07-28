import { UserContract } from "@org/contracts/api/Contracts";
import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { CreateUser } from "@/modules/user/commands/create-user.command.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const createEndpoint = Effect.fn("UserLive.create")(
  function* (request: EndpointRequest<typeof UserContract.Group, "create">) {
    const commandBus = yield* CommandBus;
    const id = yield* commandBus.execute(CreateUser, {
      email: request.payload.email,
      country: request.payload.country,
      street: request.payload.street,
      postalCode: request.payload.postalCode,
    });
    return new UserContract.CreateUserResponse({ id });
  },
  Effect.catchTag("UserAlreadyExists", (err) =>
    Effect.fail(
      new UserContract.UserAlreadyExistsError({
        email: err.email,
        message: `A user with email ${err.email} already exists`,
      }),
    ),
  ),
  recoverPersistenceUnavailable,
);
