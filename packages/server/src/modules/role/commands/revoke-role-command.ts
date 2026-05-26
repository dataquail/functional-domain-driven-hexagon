import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type RolesRepository } from "@/modules/role/domain/ports/repositories/roles-repository.js";
import { Role } from "@/modules/role/domain/role.js";
import { type DoesNotHaveRole } from "@/modules/role/domain/role-errors.js";
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

// Raw handler effect — `RolesRepository` is discharged by the wrap in
// `role-command-handlers.ts`; the bus-registered output type lives there.
export type RevokeRoleOutput = Effect.Effect<
  void,
  DoesNotHaveRole | PersistenceUnavailable,
  RolesRepository | DomainEventBus | UnitOfWork
>;
