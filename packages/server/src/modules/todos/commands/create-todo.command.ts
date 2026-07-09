import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const CreateTodoCommand = Schema.TaggedStruct("CreateTodoCommand", {
  title: Schema.String,
  organizationId: OrganizationId,
  userId: UserId,
});
export type CreateTodoCommand = typeof CreateTodoCommand.Type;

// Title is user-supplied content; not span-safe. The generated todo id is
// annotated from inside the handler instead.
export const createTodoCommandSpanAttributes: SpanAttributesExtractor<CreateTodoCommand> = (
  cmd,
) => ({ "user.id": cmd.userId, "organization.id": cmd.organizationId });
