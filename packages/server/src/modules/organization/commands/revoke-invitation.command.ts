import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeInvitation = Command.make("RevokeInvitationCommand", {
  payload: { invitationId: InvitationId, actorUserId: UserId },
  success: Schema.Void,
  failure: Schema.Union([
    InvitationNotFound,
    InvitationAlreadyAccepted,
    InvitationAlreadyRevoked,
    PersistenceUnavailable,
  ]),
});
export type RevokeInvitationPayload = Command.Payload<typeof RevokeInvitation>;
