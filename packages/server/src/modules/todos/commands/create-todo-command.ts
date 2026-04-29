import { type TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import { type Todo } from "@/modules/todos/domain/todo.js";
import { type TodosNotifier } from "@/modules/todos/domain/todos-notifier.js";
import { UserId } from "@/modules/todos/domain/user-id.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const CreateTodoCommand = Schema.TaggedStruct("CreateTodoCommand", {
  title: Schema.String,
  optimisticId: Schema.optional(Schema.String),
  userId: UserId,
});
export type CreateTodoCommand = typeof CreateTodoCommand.Type;

// Title is user-supplied content; not span-safe. The generated todo id is
// annotated from inside the handler instead.
export const createTodoCommandSpanAttributes: SpanAttributesExtractor<CreateTodoCommand> = (
  cmd,
) => ({ "user.id": cmd.userId });

export type CreateTodoOutput = Effect.Effect<Todo, never, TodosRepository | TodosNotifier>;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    CreateTodoCommand: {
      readonly command: CreateTodoCommand;
      readonly output: CreateTodoOutput;
    };
  }
}
