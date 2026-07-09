import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Browser-side approval: the signed-in user submits the `userCode` they were
// shown by the CLI; we bind the grant to them.
export const ApproveDeviceGrantCommand = Schema.TaggedStruct("ApproveDeviceGrantCommand", {
  userCode: Schema.String,
  userId: UserId,
});
export type ApproveDeviceGrantCommand = typeof ApproveDeviceGrantCommand.Type;

export const approveDeviceGrantCommandSpanAttributes: SpanAttributesExtractor<
  ApproveDeviceGrantCommand
> = (c) => ({ "user.id": c.userId });
