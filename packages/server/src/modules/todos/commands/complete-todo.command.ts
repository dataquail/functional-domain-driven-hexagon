import * as Schema from "effect/Schema";

import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// First-class "mark done" verb (ADR-0024) — distinct from `UpdateTodoCommand`
// so the CLI can complete a todo without resupplying its title.
export const CompleteTodoCommand = Schema.TaggedStruct("CompleteTodoCommand", {
  todoId: TodoId,
  organizationId: OrganizationId,
  userId: UserId,
});
export type CompleteTodoCommand = typeof CompleteTodoCommand.Type;

export const completeTodoCommandSpanAttributes: SpanAttributesExtractor<CompleteTodoCommand> = (
  cmd,
) => ({ "todo.id": cmd.todoId, "organization.id": cmd.organizationId, "user.id": cmd.userId });
