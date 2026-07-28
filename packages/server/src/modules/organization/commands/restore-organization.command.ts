import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import {
  OrganizationNotDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization/organization.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const RestoreOrganization = Command.make("RestoreOrganizationCommand", {
  payload: { organizationId: OrganizationId },
  success: Schema.Void,
  failure: Schema.Union([OrganizationNotFound, OrganizationNotDeleted, PersistenceUnavailable]),
});
export type RestoreOrganizationPayload = Command.Payload<typeof RestoreOrganization>;
