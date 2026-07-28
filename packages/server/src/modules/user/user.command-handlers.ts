import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CreateUserCommand } from "@/modules/user/commands/create-user.command.js";
import { createUserHandler } from "@/modules/user/commands/create-user.handler.js";
import { DeleteUserCommand } from "@/modules/user/commands/delete-user.command.js";
import { deleteUserHandler } from "@/modules/user/commands/delete-user.handler.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live.js";

const userCommandGroup = Command.group(CreateUserCommand, DeleteUserCommand);

const UserCommandHandlersLive = Command.handlersOf(userCommandGroup, {
  CreateUserCommand: (payload) =>
    createUserHandler(payload).pipe(Effect.provide(UserRepositoryLive)),
  DeleteUserCommand: (payload) =>
    deleteUserHandler(payload).pipe(Effect.provide(UserRepositoryLive)),
});

// Every field of `CreateUserCommand` is PII (email, postal address), so it
// contributes nothing; the generated user id is annotated from inside the handler.
const userCommandSpanAttributes: Command.SpanAttributes<typeof userCommandGroup> = {
  DeleteUserCommand: (payload) => ({ "user.id": payload.userId }),
};

// This module's slice of the write-side dispatch surface. See `WalletCommands` for
// why a module publishes its own surface rather than letting consumers name the bus;
// this is the module that makes the difference load-bearing, because the auth
// module's provisioning adapter resolves against it while the bus resolves against
// auth in turn.
export class UserCommands extends Context.Service<
  UserCommands,
  Command.Dispatcher<typeof userCommandGroup>
>()("@org/server/user/UserCommands") {}

export const UserCommandsLive = Layer.effect(
  UserCommands,
  Command.dispatcher(userCommandGroup, { spanAttributes: userCommandSpanAttributes }),
).pipe(Layer.provide(UserCommandHandlersLive));
