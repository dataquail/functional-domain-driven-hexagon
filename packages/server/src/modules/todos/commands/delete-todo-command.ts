import { type TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { type TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import { type TodosNotifier } from "@/modules/todos/domain/todos-notifier.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const DeleteTodoCommand = Schema.TaggedStruct("DeleteTodoCommand", {
  todoId: TodoId,
  userId: UserId,
});
export type DeleteTodoCommand = typeof DeleteTodoCommand.Type;

export const deleteTodoCommandSpanAttributes: SpanAttributesExtractor<DeleteTodoCommand> = (
  cmd,
) => ({ "todo.id": cmd.todoId, "user.id": cmd.userId });

export type DeleteTodoOutput = Effect.Effect<void, TodoNotFound, TodosRepository | TodosNotifier>;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    DeleteTodoCommand: {
      readonly command: DeleteTodoCommand;
      readonly output: DeleteTodoOutput;
    };
  }
}
