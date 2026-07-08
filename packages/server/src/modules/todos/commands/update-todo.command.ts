import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { type TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { type TodoRoot } from "@/modules/todos/domain/todo.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
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

// Raw handler effect — `TodosRepository` is discharged by the wrap in
// `todo-command-handlers.ts`; the bus-registered output type lives there.
export type UpdateTodoOutput = Effect.Effect<
  TodoRoot,
  TodoNotFound | PersistenceUnavailable,
  TodosRepository
>;
