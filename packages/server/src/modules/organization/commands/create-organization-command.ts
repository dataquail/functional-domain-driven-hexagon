import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import { type OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import { type OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const CreateOrganizationCommand = Schema.TaggedStruct("CreateOrganizationCommand", {
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
  // The creator — recorded as the first Membership of the org and the
  // future Phase 4 default-bundle grant target. Carried explicitly so
  // the bus boundary stays uniform; the HTTP endpoint is the one place
  // that translates `CurrentUser` into command input.
  actorUserId: UserId,
});
export type CreateOrganizationCommand = typeof CreateOrganizationCommand.Type;

export const createOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  CreateOrganizationCommand
> = (cmd) => ({ "organization.name": cmd.name, "actor.user.id": cmd.actorUserId });

// Raw handler effect — `OrganizationRepository`, `MembershipRepository`,
// and `OrganizationRolesRepository` are discharged by the wrap in
// `organization-command-handlers.ts`; the bus-registered output type
// lives there.
export type CreateOrganizationOutput = Effect.Effect<
  OrganizationId,
  PersistenceUnavailable,
  | OrganizationRepository
  | MembershipRepository
  | OrganizationRolesRepository
  | DomainEventBus
  | UnitOfWork
>;
