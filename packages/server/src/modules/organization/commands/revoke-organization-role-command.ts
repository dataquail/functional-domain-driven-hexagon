import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { OrganizationRole } from "@/modules/organization/domain/organization-role.js";
import { type DoesNotHaveOrganizationRole } from "@/modules/organization/domain/organization-role-errors.js";
import { type OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeOrganizationRoleCommand = Schema.TaggedStruct("RevokeOrganizationRoleCommand", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRole,
});
export type RevokeOrganizationRoleCommand = typeof RevokeOrganizationRoleCommand.Type;

export const revokeOrganizationRoleCommandSpanAttributes: SpanAttributesExtractor<
  RevokeOrganizationRoleCommand
> = (cmd) => ({
  "user.id": cmd.userId,
  "organization.id": cmd.organizationId,
  "organization.role": cmd.role,
});

export type RevokeOrganizationRoleOutput = Effect.Effect<
  void,
  DoesNotHaveOrganizationRole | PersistenceUnavailable,
  OrganizationRolesRepository | DomainEventBus | UnitOfWork
>;
