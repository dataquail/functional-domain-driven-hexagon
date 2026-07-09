import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { type TodoId } from "@/modules/todos/domain/todo.id.js";
import { type TodoRoot } from "@/modules/todos/domain/todo.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Every read/mutate is org-scoped (Phase 5). `findOneById` and `remove`
// take the `organizationId` explicitly so a caller can't reach a todo
// outside the org in the request path — a row in another org reads as
// `TodoNotFound`, not a leak. `insert`/`update` carry the org on the
// `TodoRoot` itself; `update`'s SQL filters on it too.
export type TodosRepositoryShape = {
  readonly insertOne: (todo: TodoRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (
    todo: TodoRoot,
  ) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly deleteOne: (
    organizationId: OrganizationId,
    id: TodoId,
  ) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly findOneById: (
    organizationId: OrganizationId,
    id: TodoId,
  ) => Effect.Effect<TodoRoot, TodoNotFound | PersistenceUnavailable>;
};

export class TodosRepository extends Context.Service<TodosRepository, TodosRepositoryShape>()(
  "TodosRepository",
) {}
