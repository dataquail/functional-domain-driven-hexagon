import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization/organization.errors.js";

// `actorUserId` is the creator — recorded as the org's first Membership. Carried
// explicitly rather than pulled from `CurrentUser` so the bus boundary stays uniform;
// the HTTP endpoint is the one place that translates request-context into command input.
export const CreateOrganizationCommand = Command.make("CreateOrganizationCommand", {
  payload: {
    name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
    actorUserId: UserId,
  },
  success: OrganizationId,
  failure: Schema.Union([SuperAdminCannotOwnOrganization, PersistenceUnavailable]),
});
export type CreateOrganizationPayload = Command.Payload<typeof CreateOrganizationCommand>;
