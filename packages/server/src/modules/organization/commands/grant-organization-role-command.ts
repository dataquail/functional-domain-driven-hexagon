import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { OrganizationRole } from "@/modules/organization/domain/organization-role.js";
import {
  type AlreadyHasOrganizationRole,
  type CannotPromoteSelfInOrganization,
} from "@/modules/organization/domain/organization-role-errors.js";
import { type OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const GrantOrganizationRoleCommand = Schema.TaggedStruct("GrantOrganizationRoleCommand", {
  // The user receiving the role.
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRole,
  // The user dispatching the command. Carried explicitly (rather than
  // pulled from `CurrentUser`) so the bus boundary stays uniform — the
  // HTTP endpoint is the one place that translates request-context
  // into command input. Persisted as `issued_by` for audit.
  actorUserId: UserId,
});
export type GrantOrganizationRoleCommand = typeof GrantOrganizationRoleCommand.Type;

export const grantOrganizationRoleCommandSpanAttributes: SpanAttributesExtractor<
  GrantOrganizationRoleCommand
> = (cmd) => ({
  "user.id": cmd.userId,
  "organization.id": cmd.organizationId,
  "organization.role": cmd.role,
  "actor.user.id": cmd.actorUserId,
});

export type GrantOrganizationRoleOutput = Effect.Effect<
  void,
  AlreadyHasOrganizationRole | CannotPromoteSelfInOrganization | PersistenceUnavailable,
  OrganizationRolesRepository | DomainEventBus | UnitOfWork
>;
