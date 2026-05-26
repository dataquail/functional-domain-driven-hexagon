import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type TodosRepository } from "@/modules/todos/domain/ports/repositories/todo-repository.js";
import { type Todo } from "@/modules/todos/domain/todo.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const CreateTodoCommand = Schema.TaggedStruct("CreateTodoCommand", {
  title: Schema.String,
  userId: UserId,
});
export type CreateTodoCommand = typeof CreateTodoCommand.Type;

// Title is user-supplied content; not span-safe. The generated todo id is
// annotated from inside the handler instead.
export const createTodoCommandSpanAttributes: SpanAttributesExtractor<CreateTodoCommand> = (
  cmd,
) => ({ "user.id": cmd.userId });

// Raw handler effect — `TodosRepository` is discharged by the wrap in
// `todo-command-handlers.ts`; the bus-registered output type lives there.
export type CreateTodoOutput = Effect.Effect<Todo, PersistenceUnavailable, TodosRepository>;
