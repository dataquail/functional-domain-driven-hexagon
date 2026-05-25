import {
  organizationCreatedSpanAttributes,
  organizationRestoredSpanAttributes,
  organizationSoftDeletedSpanAttributes,
} from "@/modules/organization/domain/organization-events.js";
import { eventSpanAttributes } from "@/platform/ddd/domain-event-bus.js";

export const organizationEventSpanAttributes = eventSpanAttributes({
  OrganizationCreated: organizationCreatedSpanAttributes,
  OrganizationSoftDeleted: organizationSoftDeletedSpanAttributes,
  OrganizationRestored: organizationRestoredSpanAttributes,
});
