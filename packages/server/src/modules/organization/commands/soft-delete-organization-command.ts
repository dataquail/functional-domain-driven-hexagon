import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type OrganizationAlreadyDeleted,
  type OrganizationNotFound,
} from "@/modules/organization/domain/organization-errors.js";
import { type OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const SoftDeleteOrganizationCommand = Schema.TaggedStruct("SoftDeleteOrganizationCommand", {
  organizationId: OrganizationId,
});
export type SoftDeleteOrganizationCommand = typeof SoftDeleteOrganizationCommand.Type;

export const softDeleteOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  SoftDeleteOrganizationCommand
> = (cmd) => ({ "organization.id": cmd.organizationId });

// Raw handler effect — `OrganizationRepository` is discharged by the
// wrap in `organization-command-handlers.ts`; the bus-registered output
// type lives there.
export type SoftDeleteOrganizationOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationAlreadyDeleted | PersistenceUnavailable,
  OrganizationRepository | DomainEventBus | UnitOfWork
>;
