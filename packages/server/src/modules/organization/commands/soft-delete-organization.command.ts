import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import {
  OrganizationAlreadyDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization/organization.errors.js";

export const SoftDeleteOrganizationCommand = Command.make("SoftDeleteOrganizationCommand", {
  payload: { organizationId: OrganizationId },
  success: Schema.Void,
  failure: Schema.Union([OrganizationNotFound, OrganizationAlreadyDeleted, PersistenceUnavailable]),
});
export type SoftDeleteOrganizationPayload = Command.Payload<typeof SoftDeleteOrganizationCommand>;
