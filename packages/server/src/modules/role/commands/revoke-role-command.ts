import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { Role } from "@/modules/role/domain/role.js";
import { type DoesNotHaveRole } from "@/modules/role/domain/role-errors.js";
import { type RolesRepository } from "@/modules/role/domain/roles-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeRoleCommand = Schema.TaggedStruct("RevokeRoleCommand", {
  userId: UserId,
  role: Role,
});
export type RevokeRoleCommand = typeof RevokeRoleCommand.Type;

export const revokeRoleCommandSpanAttributes: SpanAttributesExtractor<RevokeRoleCommand> = (
  cmd,
) => ({
  "user.id": cmd.userId,
  "role.name": cmd.role,
});

export type RevokeRoleOutput = Effect.Effect<
  void,
  DoesNotHaveRole | PersistenceUnavailable,
  RolesRepository | DomainEventBus | UnitOfWork
>;

declare module "@/platform/ddd/command-bus.js" {
  interface CommandRegistry {
    RevokeRoleCommand: {
      readonly command: RevokeRoleCommand;
      readonly output: RevokeRoleOutput;
    };
  }
}
