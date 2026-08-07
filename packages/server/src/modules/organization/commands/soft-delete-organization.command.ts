import { Command, PersistenceUnavailable } from "@org/cqrs";
import * as Schema from "effect/Schema";

import {
  OrganizationAlreadyDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const SoftDeleteOrganizationCommand = Command.make("SoftDeleteOrganizationCommand", {
  payload: { organizationId: OrganizationId },
  success: Schema.Void,
  failure: Schema.Union([OrganizationNotFound, OrganizationAlreadyDeleted, PersistenceUnavailable]),
});
export type SoftDeleteOrganizationPayload = Command.Payload<typeof SoftDeleteOrganizationCommand>;
