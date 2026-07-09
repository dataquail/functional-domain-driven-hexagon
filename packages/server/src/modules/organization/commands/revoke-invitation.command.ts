import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeInvitationCommand = Schema.TaggedStruct("RevokeInvitationCommand", {
  invitationId: InvitationId,
  actorUserId: UserId,
});
export type RevokeInvitationCommand = typeof RevokeInvitationCommand.Type;

export const revokeInvitationCommandSpanAttributes: SpanAttributesExtractor<
  RevokeInvitationCommand
> = (cmd) => ({ "invitation.id": cmd.invitationId, "actor.user.id": cmd.actorUserId });
