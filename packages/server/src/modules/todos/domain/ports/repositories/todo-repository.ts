import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type Todo } from "@/modules/todos/domain/todo.js";
import { type TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { type TodoId } from "@/modules/todos/domain/todo-id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Every read/mutate is org-scoped (Phase 5). `findById` and `remove`
// take the `organizationId` explicitly so a caller can't reach a todo
// outside the org in the request path — a row in another org reads as
// `TodoNotFound`, not a leak. `insert`/`update` carry the org on the
// `Todo` itself; `update`'s SQL filters on it too.
export type TodosRepositoryShape = {
  readonly insert: (todo: Todo) => Effect.Effect<void, PersistenceUnavailable>;
  readonly update: (todo: Todo) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly remove: (
    organizationId: OrganizationId,
    id: TodoId,
  ) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly findById: (
    organizationId: OrganizationId,
    id: TodoId,
  ) => Effect.Effect<Todo, TodoNotFound | PersistenceUnavailable>;
};

export class TodosRepository extends Context.Tag("TodosRepository")<
  TodosRepository,
  TodosRepositoryShape
>() {}
