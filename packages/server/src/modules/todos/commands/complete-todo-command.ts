import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type TodosRepository } from "@/modules/todos/domain/ports/repositories/todo-repository.js";
import { type Todo } from "@/modules/todos/domain/todo.js";
import { type TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
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

// Raw handler effect — `TodosRepository` is discharged by the wrap in
// `todo-command-handlers.ts`; the bus-registered output type lives there.
export type CompleteTodoOutput = Effect.Effect<
  Todo,
  TodoNotFound | PersistenceUnavailable,
  TodosRepository
>;
