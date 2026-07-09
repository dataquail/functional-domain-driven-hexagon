import * as Schema from "effect/Schema";

import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const DeleteTodoCommand = Schema.TaggedStruct("DeleteTodoCommand", {
  todoId: TodoId,
  organizationId: OrganizationId,
  userId: UserId,
});
export type DeleteTodoCommand = typeof DeleteTodoCommand.Type;

export const deleteTodoCommandSpanAttributes: SpanAttributesExtractor<DeleteTodoCommand> = (
  cmd,
) => ({ "todo.id": cmd.todoId, "organization.id": cmd.organizationId, "user.id": cmd.userId });
