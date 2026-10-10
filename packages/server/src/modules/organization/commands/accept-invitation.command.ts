import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import {
  InvitationAlreadyAccepted,
  InvitationExpired,
  InvitationRevoked,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization/organization.errors.js";

export const AcceptInvitationCommand = Command.make("AcceptInvitationCommand", {
  payload: { token: Schema.String, userId: UserId },
  success: OrganizationId,
  failure: Schema.Union([
    InvitationTokenNotFound,
    InvitationAlreadyAccepted,
    InvitationRevoked,
    InvitationExpired,
    SuperAdminCannotOwnOrganization,
    PersistenceUnavailable,
  ]),
});
export type AcceptInvitationPayload = Command.Payload<typeof AcceptInvitationCommand>;
