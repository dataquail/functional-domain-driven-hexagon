import { Api } from "@/api.js";
import { ChangeUserRoleCommand } from "@/modules/user/application/commands/change-user-role-command.js";
import { CreateUserCommand } from "@/modules/user/application/commands/create-user-command.js";
import { DeleteUserCommand } from "@/modules/user/application/commands/delete-user-command.js";
import { FindUsersQuery } from "@/modules/user/application/queries/find-users-query.js";
import { CommandBus } from "@/platform/command-bus.js";
import { QueryBus } from "@/platform/query-bus.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

export const UserHttpLive = HttpApiBuilder.group(Api, "user", (handlers) =>
  handlers
    .handle("find", (request) =>
      Effect.gen(function* () {
        const queryBus = yield* QueryBus;
        return yield* queryBus.execute(
          FindUsersQuery.make({
            page: request.urlParams.page,
            pageSize: request.urlParams.pageSize,
          }),
        );
      }).pipe(Effect.withSpan("UserHttpLive.find")),
    )
    .handle("create", (request) =>
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
      ),
    )
    .handle("delete", (request) =>
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
        Effect.withSpan("UserHttpLive.delete"),
      ),
    )
    .handle("changeRole", (request) =>
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
      ),
    ),
);
