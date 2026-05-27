import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { grantRole } from "@/modules/role/commands/grant-role.js";
import {
  type GrantRoleCommand,
  grantRoleCommandSpanAttributes,
} from "@/modules/role/commands/grant-role-command.js";
import { revokeRole } from "@/modules/role/commands/revoke-role.js";
import {
  type RevokeRoleCommand,
  revokeRoleCommandSpanAttributes,
} from "@/modules/role/commands/revoke-role-command.js";
import {
  type AlreadyHasRole,
  type CannotPromoteSelf,
  type DoesNotHaveRole,
} from "@/modules/role/domain/role-errors.js";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/roles-repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Bus-visible output types: the raw handlers in `commands/` carry
// `RolesRepository` in R; the wraps below discharge that via
// `RolesRepositoryLive`, leaving the platform-shared deps
// (`Database`, `DomainEventBus`, `UnitOfWork`) in R for runtime swap.
type GrantRoleBusOutput = Effect.Effect<
  void,
  AlreadyHasRole | CannotPromoteSelf | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type RevokeRoleBusOutput = Effect.Effect<
  void,
  DoesNotHaveRole | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    GrantRoleCommand: {
      readonly command: GrantRoleCommand;
      readonly output: GrantRoleBusOutput;
    };
    RevokeRoleCommand: {
      readonly command: RevokeRoleCommand;
      readonly output: RevokeRoleBusOutput;
    };
  }
}

export const roleCommandHandlers = commandHandlers({
  GrantRoleCommand: {
    handle: (cmd): GrantRoleBusOutput => grantRole(cmd).pipe(Effect.provide(RolesRepositoryLive)),
    spanAttributes: grantRoleCommandSpanAttributes,
  },
  RevokeRoleCommand: {
    handle: (cmd): RevokeRoleBusOutput => revokeRole(cmd).pipe(Effect.provide(RolesRepositoryLive)),
    spanAttributes: revokeRoleCommandSpanAttributes,
  },
});
