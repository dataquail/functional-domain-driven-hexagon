import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const AcceptInvitationCommand = Schema.TaggedStruct("AcceptInvitationCommand", {
  token: Schema.String,
  userId: UserId,
});
export type AcceptInvitationCommand = typeof AcceptInvitationCommand.Type;

// Token deliberately omitted from the span — it's a bearer credential.
// The invitation id is annotated inside the handler once resolved.
export const acceptInvitationCommandSpanAttributes: SpanAttributesExtractor<
  AcceptInvitationCommand
> = (cmd) => ({ "user.id": cmd.userId });
