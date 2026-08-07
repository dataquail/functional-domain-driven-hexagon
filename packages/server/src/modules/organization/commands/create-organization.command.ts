import { Command, PersistenceUnavailable } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

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
