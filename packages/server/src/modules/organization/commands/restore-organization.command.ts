import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import {
  OrganizationNotDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization/organization.errors.js";

export const RestoreOrganizationCommand = Command.make("RestoreOrganizationCommand", {
  payload: { organizationId: OrganizationId },
  success: Schema.Void,
  failure: Schema.Union([OrganizationNotFound, OrganizationNotDeleted, PersistenceUnavailable]),
});
export type RestoreOrganizationPayload = Command.Payload<typeof RestoreOrganizationCommand>;
