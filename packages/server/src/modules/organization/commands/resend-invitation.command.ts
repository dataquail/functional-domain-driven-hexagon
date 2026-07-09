import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const ResendInvitationCommand = Schema.TaggedStruct("ResendInvitationCommand", {
  invitationId: InvitationId,
  ttlSeconds: Schema.Number,
  actorUserId: UserId,
});
export type ResendInvitationCommand = typeof ResendInvitationCommand.Type;

export const resendInvitationCommandSpanAttributes: SpanAttributesExtractor<
  ResendInvitationCommand
> = (cmd) => ({ "invitation.id": cmd.invitationId, "actor.user.id": cmd.actorUserId });
