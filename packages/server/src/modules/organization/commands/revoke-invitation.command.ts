import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeInvitationCommand = Command.make("RevokeInvitationCommand", {
  payload: { invitationId: InvitationId, actorUserId: UserId },
  success: Schema.Void,
  failure: Schema.Union([
    InvitationNotFound,
    InvitationAlreadyAccepted,
    InvitationAlreadyRevoked,
    PersistenceUnavailable,
  ]),
});
export type RevokeInvitationPayload = Command.Payload<typeof RevokeInvitationCommand>;
