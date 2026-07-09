import * as Schema from "effect/Schema";

import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const UpdateTodoCommand = Schema.TaggedStruct("UpdateTodoCommand", {
  todoId: TodoId,
  organizationId: OrganizationId,
  title: Schema.String,
  completed: Schema.Boolean,
  userId: UserId,
});
export type UpdateTodoCommand = typeof UpdateTodoCommand.Type;

export const updateTodoCommandSpanAttributes: SpanAttributesExtractor<UpdateTodoCommand> = (
  cmd,
) => ({
  "todo.id": cmd.todoId,
  "organization.id": cmd.organizationId,
  "todo.completed": cmd.completed,
  "user.id": cmd.userId,
});
