import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type OrganizationNotDeleted,
  type OrganizationNotFound,
} from "@/modules/organization/domain/organization-errors.js";
import { type OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const RestoreOrganizationCommand = Schema.TaggedStruct("RestoreOrganizationCommand", {
  organizationId: OrganizationId,
});
export type RestoreOrganizationCommand = typeof RestoreOrganizationCommand.Type;

export const restoreOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  RestoreOrganizationCommand
> = (cmd) => ({ "organization.id": cmd.organizationId });

// Raw handler effect — `OrganizationRepository` is discharged by the
// wrap in `organization-command-handlers.ts`; the bus-registered output
// type lives there.
export type RestoreOrganizationOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationNotDeleted | PersistenceUnavailable,
  OrganizationRepository | DomainEventBus | UnitOfWork
>;
