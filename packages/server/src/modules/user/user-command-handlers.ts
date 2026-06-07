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
import { demoteFromSuperAdmin } from "@/modules/user/commands/demote-from-super-admin.js";
import {
  type DemoteFromSuperAdminCommand,
  demoteFromSuperAdminCommandSpanAttributes,
} from "@/modules/user/commands/demote-from-super-admin-command.js";
import { promoteToSuperAdmin } from "@/modules/user/commands/promote-to-super-admin.js";
import {
  type PromoteToSuperAdminCommand,
  promoteToSuperAdminCommandSpanAttributes,
} from "@/modules/user/commands/promote-to-super-admin-command.js";
import {
  type RoleManagement,
  type SelfPromotionForbidden,
} from "@/modules/user/domain/ports/external/role-management.js";
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

// Promote/Demote leave `RoleManagement` in R — the port is provided at
// the module-Live boundary (`UserModuleLive` bundles
// `RoleManagementLive`), same shape as billing's `BillingGateway`
// flowing through its commands' bus outputs.
type PromoteToSuperAdminBusOutput = Effect.Effect<
  void,
  SelfPromotionForbidden | PersistenceUnavailable,
  RoleManagement
>;

type DemoteFromSuperAdminBusOutput = Effect.Effect<void, PersistenceUnavailable, RoleManagement>;

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
    PromoteToSuperAdminCommand: {
      readonly command: PromoteToSuperAdminCommand;
      readonly output: PromoteToSuperAdminBusOutput;
    };
    DemoteFromSuperAdminCommand: {
      readonly command: DemoteFromSuperAdminCommand;
      readonly output: DemoteFromSuperAdminBusOutput;
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
  PromoteToSuperAdminCommand: {
    handle: (cmd): PromoteToSuperAdminBusOutput => promoteToSuperAdmin(cmd),
    spanAttributes: promoteToSuperAdminCommandSpanAttributes,
  },
  DemoteFromSuperAdminCommand: {
    handle: (cmd): DemoteFromSuperAdminBusOutput => demoteFromSuperAdmin(cmd),
    spanAttributes: demoteFromSuperAdminCommandSpanAttributes,
  },
});
