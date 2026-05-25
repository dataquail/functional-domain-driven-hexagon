import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { createOrganization } from "@/modules/organization/commands/create-organization.js";
import {
  type CreateOrganizationCommand,
  createOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/create-organization-command.js";
import { restoreOrganization } from "@/modules/organization/commands/restore-organization.js";
import {
  type RestoreOrganizationCommand,
  restoreOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/restore-organization-command.js";
import { softDeleteOrganization } from "@/modules/organization/commands/soft-delete-organization.js";
import {
  type SoftDeleteOrganizationCommand,
  softDeleteOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/soft-delete-organization-command.js";
import {
  type OrganizationAlreadyDeleted,
  type OrganizationNotDeleted,
  type OrganizationNotFound,
} from "@/modules/organization/domain/organization-errors.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/organization-repository-live.js";
import { commandHandlers } from "@/platform/ddd/command-bus.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

type CreateOrganizationBusOutput = Effect.Effect<
  OrganizationId,
  PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type RestoreOrganizationBusOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationNotDeleted | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type SoftDeleteOrganizationBusOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationAlreadyDeleted | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/command-bus.js" {
  interface CommandRegistry {
    CreateOrganizationCommand: {
      readonly command: CreateOrganizationCommand;
      readonly output: CreateOrganizationBusOutput;
    };
    RestoreOrganizationCommand: {
      readonly command: RestoreOrganizationCommand;
      readonly output: RestoreOrganizationBusOutput;
    };
    SoftDeleteOrganizationCommand: {
      readonly command: SoftDeleteOrganizationCommand;
      readonly output: SoftDeleteOrganizationBusOutput;
    };
  }
}

export const organizationCommandHandlers = commandHandlers({
  CreateOrganizationCommand: {
    handle: (cmd): CreateOrganizationBusOutput =>
      createOrganization(cmd).pipe(Effect.provide(OrganizationRepositoryLive)),
    spanAttributes: createOrganizationCommandSpanAttributes,
  },
  SoftDeleteOrganizationCommand: {
    handle: (cmd): SoftDeleteOrganizationBusOutput =>
      softDeleteOrganization(cmd).pipe(Effect.provide(OrganizationRepositoryLive)),
    spanAttributes: softDeleteOrganizationCommandSpanAttributes,
  },
  RestoreOrganizationCommand: {
    handle: (cmd): RestoreOrganizationBusOutput =>
      restoreOrganization(cmd).pipe(Effect.provide(OrganizationRepositoryLive)),
    spanAttributes: restoreOrganizationCommandSpanAttributes,
  },
});
