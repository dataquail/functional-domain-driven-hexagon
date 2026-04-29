import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import { type TodoNotFound } from "./todo-errors.js";
import { type TodoId } from "./todo-id.js";
import { type Todo } from "./todo.js";

export type TodosRepositoryShape = {
  readonly insert: (todo: Todo) => Effect.Effect<void>;
  readonly update: (todo: Todo) => Effect.Effect<void, TodoNotFound>;
  readonly remove: (id: TodoId) => Effect.Effect<void, TodoNotFound>;
  readonly findById: (id: TodoId) => Effect.Effect<Todo, TodoNotFound>;
};

export class TodosRepository extends Context.Tag("TodosRepository")<
  TodosRepository,
  TodosRepositoryShape
>() {}
