import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";

import { type Todo } from "./todo.js";
import { type TodoNotFound } from "./todo-errors.js";
import { type TodoId } from "./todo-id.js";

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
