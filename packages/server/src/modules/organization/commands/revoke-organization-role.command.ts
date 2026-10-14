import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { DoesNotHaveOrganizationRole } from "@/modules/organization/domain/organization-roles/organization-role.errors.ts";
import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.ts";

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
