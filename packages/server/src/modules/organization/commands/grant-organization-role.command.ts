import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import {
  AlreadyHasOrganizationRole,
  CannotPromoteSelfInOrganization,
} from "@/modules/organization/domain/organization-roles/organization-role.errors.js";
import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// `actorUserId` is carried explicitly rather than pulled from `CurrentUser` so the bus
// boundary stays uniform — the HTTP endpoint is the one place that translates
// request-context into command input. It is persisted as `issued_by` for audit.
export const GrantOrganizationRoleCommand = Command.make("GrantOrganizationRoleCommand", {
  payload: {
    // The user receiving the role.
    userId: UserId,
    organizationId: OrganizationId,
    role: OrganizationRoleValueObject,
    actorUserId: UserId,
  },
  success: Schema.Void,
  failure: Schema.Union([
    AlreadyHasOrganizationRole,
    CannotPromoteSelfInOrganization,
    PersistenceUnavailable,
  ]),
});
export type GrantOrganizationRolePayload = Command.Payload<typeof GrantOrganizationRoleCommand>;
