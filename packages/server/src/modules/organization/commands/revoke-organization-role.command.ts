import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { DoesNotHaveOrganizationRole } from "@/modules/organization/domain/organization-roles/organization-role.errors.js";
import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeOrganizationRoleCommand = Command.make("RevokeOrganizationRoleCommand", {
  payload: {
    userId: UserId,
    organizationId: OrganizationId,
    role: OrganizationRoleValueObject,
  },
  success: Schema.Void,
  failure: Schema.Union([DoesNotHaveOrganizationRole, PersistenceUnavailable]),
});
export type RevokeOrganizationRolePayload = Command.Payload<typeof RevokeOrganizationRoleCommand>;
