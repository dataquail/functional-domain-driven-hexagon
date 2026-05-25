import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

export const CreateOrganizationCommand = Schema.TaggedStruct("CreateOrganizationCommand", {
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
});
export type CreateOrganizationCommand = typeof CreateOrganizationCommand.Type;

export const createOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  CreateOrganizationCommand
> = (cmd) => ({ "organization.name": cmd.name });

// Raw handler effect — `OrganizationRepository` is discharged by the
// wrap in `organization-command-handlers.ts`; the bus-registered output
// type lives there.
export type CreateOrganizationOutput = Effect.Effect<
  OrganizationId,
  PersistenceUnavailable,
  OrganizationRepository | DomainEventBus | UnitOfWork
>;
