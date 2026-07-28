import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import {
  OrganizationAlreadyDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization/organization.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const SoftDeleteOrganization = Command.make("SoftDeleteOrganizationCommand", {
  payload: { organizationId: OrganizationId },
  success: Schema.Void,
  failure: Schema.Union([OrganizationNotFound, OrganizationAlreadyDeleted, PersistenceUnavailable]),
});
export type SoftDeleteOrganizationPayload = Command.Payload<typeof SoftDeleteOrganization>;
