import * as Schema from "effect/Schema";

import { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const OrganizationCreated = DomainEvent("OrganizationCreated", {
  organizationId: OrganizationId,
  name: Schema.String,
});
export type OrganizationCreated = typeof OrganizationCreated.Type;

export const organizationCreatedSpanAttributes: SpanAttributesExtractor<OrganizationCreated> = (
  event,
) => ({ "organization.id": event.organizationId });

export const OrganizationSoftDeleted = DomainEvent("OrganizationSoftDeleted", {
  organizationId: OrganizationId,
});
export type OrganizationSoftDeleted = typeof OrganizationSoftDeleted.Type;

export const organizationSoftDeletedSpanAttributes: SpanAttributesExtractor<
  OrganizationSoftDeleted
> = (event) => ({ "organization.id": event.organizationId });

export const OrganizationRestored = DomainEvent("OrganizationRestored", {
  organizationId: OrganizationId,
});
export type OrganizationRestored = typeof OrganizationRestored.Type;

export const organizationRestoredSpanAttributes: SpanAttributesExtractor<OrganizationRestored> = (
  event,
) => ({ "organization.id": event.organizationId });

export type OrganizationEvent =
  | OrganizationCreated
  | OrganizationSoftDeleted
  | OrganizationRestored;
