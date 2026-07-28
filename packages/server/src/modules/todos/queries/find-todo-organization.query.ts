import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const TodoOrganizationView = Schema.Struct({
  organizationId: OrganizationId,
});
export type TodoOrganizationView = typeof TodoOrganizationView.Type;

// Existence projection backing the per-item `todo` authz resource. The query is
// scoped to BOTH ids, so a todo living in another organization reads as absent —
// tenant isolation folded into the resolve step rather than left to the check.
//
// Returns null rather than failing; the resolver turns absence into `NotFound`.
export const FindTodoOrganization = Query.make("FindTodoOrganizationQuery", {
  payload: { organizationId: OrganizationId, todoId: TodoId },
  success: Schema.NullOr(TodoOrganizationView),
  failure: PersistenceUnavailable,
});
export type FindTodoOrganizationPayload = Query.Payload<typeof FindTodoOrganization>;
