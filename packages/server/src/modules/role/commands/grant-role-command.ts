import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type RolesRepository } from "@/modules/role/domain/ports/repositories/roles-repository.js";
import { Role } from "@/modules/role/domain/role.js";
import { type AlreadyHasRole, type CannotPromoteSelf } from "@/modules/role/domain/role-errors.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const GrantRoleCommand = Schema.TaggedStruct("GrantRoleCommand", {
  // The user receiving the role.
  userId: UserId,
  role: Role,
  // The user dispatching the command. Carried explicitly (rather than
  // pulled from `CurrentUser`) so the bus boundary stays uniform — the
  // HTTP endpoint is the one place that translates request-context
  // into command input.
  actorUserId: UserId,
});
export type GrantRoleCommand = typeof GrantRoleCommand.Type;

export const grantRoleCommandSpanAttributes: SpanAttributesExtractor<GrantRoleCommand> = (cmd) => ({
  "user.id": cmd.userId,
  "role.name": cmd.role,
  "actor.user.id": cmd.actorUserId,
});

// Raw handler effect — `RolesRepository` is discharged by the wrap in
// `role-command-handlers.ts`; the bus-registered output type lives there.
export type GrantRoleOutput = Effect.Effect<
  void,
  AlreadyHasRole | CannotPromoteSelf | PersistenceUnavailable,
  RolesRepository | DomainEventBus | UnitOfWork
>;
