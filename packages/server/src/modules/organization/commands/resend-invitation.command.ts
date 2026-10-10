import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.js";

export const ResendInvitationCommand = Command.make("ResendInvitationCommand", {
  payload: {
    invitationId: InvitationId,
    ttlSeconds: Schema.Int,
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
