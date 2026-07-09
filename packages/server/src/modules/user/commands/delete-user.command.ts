import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const DeleteUserCommand = Schema.TaggedStruct("DeleteUserCommand", {
  userId: UserId,
});
export type DeleteUserCommand = typeof DeleteUserCommand.Type;

export const deleteUserCommandSpanAttributes: SpanAttributesExtractor<DeleteUserCommand> = (
  cmd,
) => ({ "user.id": cmd.userId });
