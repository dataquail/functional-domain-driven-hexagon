import { Command, PersistenceUnavailable } from "@org/cqrs";
import * as Schema from "effect/Schema";

import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const ResendInvitationCommand = Command.make("ResendInvitationCommand", {
  payload: {
    invitationId: InvitationId,
    ttlSeconds: Schema.Number,
    actorUserId: UserId,
  },
  success: Schema.Void,
  failure: Schema.Union([
    InvitationNotFound,
    InvitationAlreadyAccepted,
    InvitationAlreadyRevoked,
    PersistenceUnavailable,
  ]),
});
export type ResendInvitationPayload = Command.Payload<typeof ResendInvitationCommand>;
