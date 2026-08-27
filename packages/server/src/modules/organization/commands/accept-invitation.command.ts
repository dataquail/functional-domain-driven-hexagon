import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import {
  InvitationAlreadyAccepted,
  InvitationExpired,
  InvitationRevoked,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

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
