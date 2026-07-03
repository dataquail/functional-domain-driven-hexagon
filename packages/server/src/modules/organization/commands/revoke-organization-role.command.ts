import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type DoesNotHaveOrganizationRole } from "@/modules/organization/domain/organization-role.errors.js";
import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-role.value-object.js";
import { type OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeOrganizationRoleCommand = Schema.TaggedStruct("RevokeOrganizationRoleCommand", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRoleValueObject,
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
