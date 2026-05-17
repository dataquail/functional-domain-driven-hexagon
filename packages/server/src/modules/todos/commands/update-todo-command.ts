import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type Todo } from "@/modules/todos/domain/todo.js";
import { type TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { type TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const UpdateTodoCommand = Schema.TaggedStruct("UpdateTodoCommand", {
  todoId: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
  userId: UserId,
});
export type UpdateTodoCommand = typeof UpdateTodoCommand.Type;

export const updateTodoCommandSpanAttributes: SpanAttributesExtractor<UpdateTodoCommand> = (
  cmd,
) => ({ "todo.id": cmd.todoId, "todo.completed": cmd.completed, "user.id": cmd.userId });

export type UpdateTodoOutput = Effect.Effect<Todo, TodoNotFound, TodosRepository>;

declare module "@/platform/ddd/command-bus.js" {
  interface CommandRegistry {
    UpdateTodoCommand: {
      readonly command: UpdateTodoCommand;
      readonly output: UpdateTodoOutput;
    };
  }
}
