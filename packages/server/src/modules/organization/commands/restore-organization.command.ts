import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import {
  OrganizationNotDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const RestoreOrganizationCommand = Command.make("RestoreOrganizationCommand", {
  payload: { organizationId: OrganizationId },
  success: Schema.Void,
  failure: Schema.Union([OrganizationNotFound, OrganizationNotDeleted, PersistenceUnavailable]),
});
export type RestoreOrganizationPayload = Command.Payload<typeof RestoreOrganizationCommand>;
