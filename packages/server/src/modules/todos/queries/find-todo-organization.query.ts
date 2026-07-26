import * as Schema from "effect/Schema";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Existence projection backing the per-item `todo` authz resource. The query is
// scoped to BOTH ids, so a todo living in another organization reads as absent —
// tenant isolation folded into the resolve step rather than left to the check.
//
// Returns null rather than failing; the resolver turns absence into `NotFound`.
export const FindTodoOrganizationQuery = Schema.TaggedStruct("FindTodoOrganizationQuery", {
  organizationId: OrganizationId,
  todoId: TodoId,
});
export type FindTodoOrganizationQuery = typeof FindTodoOrganizationQuery.Type;

export type TodoOrganizationView = {
  readonly organizationId: OrganizationId;
};

export const findTodoOrganizationQuerySpanAttributes: SpanAttributesExtractor<
  FindTodoOrganizationQuery
> = (query) => ({
  "query.organizationId": query.organizationId,
  "query.todoId": query.todoId,
});
