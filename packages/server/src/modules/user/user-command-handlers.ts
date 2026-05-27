import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { createUser } from "@/modules/user/commands/create-user.js";
import {
  type CreateUserCommand,
  createUserCommandSpanAttributes,
} from "@/modules/user/commands/create-user-command.js";
import { deleteUser } from "@/modules/user/commands/delete-user.js";
import {
  type DeleteUserCommand,
  deleteUserCommandSpanAttributes,
} from "@/modules/user/commands/delete-user-command.js";
import { type UserAlreadyExists, type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/user-repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { type UserId } from "@/platform/ids/user-id.js";

type CreateUserBusOutput = Effect.Effect<
  UserId,
  UserAlreadyExists | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type DeleteUserBusOutput = Effect.Effect<
  void,
  UserNotFound | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    CreateUserCommand: {
      readonly command: CreateUserCommand;
      readonly output: CreateUserBusOutput;
    };
    DeleteUserCommand: {
      readonly command: DeleteUserCommand;
      readonly output: DeleteUserBusOutput;
    };
  }
}

export const userCommandHandlers = commandHandlers({
  CreateUserCommand: {
    handle: (cmd): CreateUserBusOutput => createUser(cmd).pipe(Effect.provide(UserRepositoryLive)),
    spanAttributes: createUserCommandSpanAttributes,
  },
  DeleteUserCommand: {
    handle: (cmd): DeleteUserBusOutput => deleteUser(cmd).pipe(Effect.provide(UserRepositoryLive)),
    spanAttributes: deleteUserCommandSpanAttributes,
  },
});
