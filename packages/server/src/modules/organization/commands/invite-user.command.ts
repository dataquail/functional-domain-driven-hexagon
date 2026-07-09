import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const InviteUserCommand = Schema.TaggedStruct("InviteUserCommand", {
  organizationId: OrganizationId,
  inviteeEmail: Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(320)),
  ttlSeconds: Schema.Number,
  actorUserId: UserId,
});
export type InviteUserCommand = typeof InviteUserCommand.Type;

// `inviteeEmail` is intentionally not in the span — it's PII. The
// generated invitation id is annotated from inside the handler.
export const inviteUserCommandSpanAttributes: SpanAttributesExtractor<InviteUserCommand> = (
  cmd,
) => ({ "organization.id": cmd.organizationId, "actor.user.id": cmd.actorUserId });
