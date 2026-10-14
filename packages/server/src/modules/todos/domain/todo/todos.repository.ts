import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { type TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.ts";
import { type TodoId } from "@/modules/todos/domain/todo/todo.id.ts";
import { type TodoRoot } from "@/modules/todos/domain/todo/todo.root.ts";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update/delete
// the aggregate, and read it back by a Specification. Every read is org-scoped
// (Phase 5): a caller pins the org in the spec — `Spec.and(withId(id),
// forOrganization(orgId))` (see TodoSpecifications) — so a row in another org
// reads as absent (`None`), not a leak. `deleteOne` still takes the org
// explicitly; `insert`/`update` carry it on the `TodoRoot` and `update`'s SQL
// filters on it too. Absence is `Option.none()`; mapping it to a domain 404
// (TodoNotFound) is the caller's job.
export type TodosRepositoryService = {
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
  ) => Effect.Effect<Option.Option<TodoRoot>, PersistenceUnavailable>;
};

export class TodosRepository extends Context.Service<TodosRepository, TodosRepositoryService>()(
  "TodosRepository",
) {}
