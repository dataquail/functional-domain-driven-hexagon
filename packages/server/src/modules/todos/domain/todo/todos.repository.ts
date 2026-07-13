import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { type TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { type TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update/delete
// the aggregate, and read it back by a Specification. Every read is org-scoped
// (Phase 5): a caller pins the org in the spec — `Spec.and(withId(id),
// forOrganization(orgId))` (see TodoSpecifications) — so a row in another org
// reads as absent (`null`), not a leak. `deleteOne` still takes the org
// explicitly; `insert`/`update` carry it on the `TodoRoot` and `update`'s SQL
// filters on it too. Absence is a plain `null`; mapping it to a domain 404
// (TodoNotFound) is the caller's job.
export type TodosRepositoryShape = {
  readonly insertOne: (todo: TodoRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (
    todo: TodoRoot,
  ) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly deleteOne: (
    organizationId: OrganizationId,
    id: TodoId,
  ) => Effect.Effect<void, TodoNotFound | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<TodoRoot>,
  ) => Effect.Effect<TodoRoot | null, PersistenceUnavailable>;
};

export class TodosRepository extends Context.Service<TodosRepository, TodosRepositoryShape>()(
  "TodosRepository",
) {}
