import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { DoesNotHaveOrganizationRole } from "@/modules/organization/domain/organization-roles/organization-role.errors";
import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object";

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
