import { type Command, type Query } from "@effect-server-utils/cqrs";
import { Module } from "@org/module";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type userCommandGroup, UserCommands } from "./user.command-handlers.js";
import { UserQueries, type userQueryGroup } from "./user.query-handlers.js";

// The peer surface: the individual messages other modules may dispatch, named
// one by one. `DeleteUserCommand` and `FindUsersQuery` are deliberately absent —
// handing out `UserCommands` and `UserQueries` would have granted both.
export class UserExports extends Context.Service<
  UserExports,
  Pick<Command.Dispatcher<typeof userCommandGroup>, "CreateUserCommand"> &
    Pick<Query.Dispatcher<typeof userQueryGroup>, "FindUsersByIdsQuery">
>()("@org/server/user/UserExports") {}

export const UserExportsLive = Layer.effect(
  UserExports,
  Effect.gen(function* () {
    const commands = yield* UserCommands;
    const queries = yield* UserQueries;
    return UserExports.of({
      CreateUserCommand: commands.CreateUserCommand,
      FindUsersByIdsQuery: queries.FindUsersByIdsQuery,
    });
  }),
);

// Auth provisions a user on first sign-in; organization reads members' emails.
export const userExports = Module.exports(UserExports);

// Part of `CreateUserCommand`'s published failure channel: a module that
// provisions through this one has to be able to name the outcome it translates.
export { UserAlreadyExists } from "./domain/user/user.errors.js";
