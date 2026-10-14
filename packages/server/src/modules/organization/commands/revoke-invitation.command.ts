import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.ts";

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
