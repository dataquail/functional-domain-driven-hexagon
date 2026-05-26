import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type Todo } from "@/modules/todos/domain/todo.js";
import { type TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { type TodoId } from "@/modules/todos/domain/todo-id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";

export type TodosRepositoryShape = {
  readonly insert: (todo: Todo) => Effect.Effect<void, PersistenceUnavailable>;
  readonly update: (todo: Todo) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly remove: (id: TodoId) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly findById: (id: TodoId) => Effect.Effect<Todo, TodoNotFound | PersistenceUnavailable>;
};

export class TodosRepository extends Context.Tag("TodosRepository")<
  TodosRepository,
  TodosRepositoryShape
>() {}
