import * as Schema from "effect/Schema";

import { type TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const ListTodosQuery = Schema.TaggedStruct("ListTodosQuery", {
  organizationId: OrganizationId,
});
export type ListTodosQuery = typeof ListTodosQuery.Type;

export const listTodosQuerySpanAttributes: SpanAttributesExtractor<ListTodosQuery> = (query) => ({
  "organization.id": query.organizationId,
});

export type ListTodosTodoView = {
  readonly id: TodoId;
  readonly title: string;
  readonly completed: boolean;
};

export type ListTodosResult = {
  readonly todos: ReadonlyArray<ListTodosTodoView>;
};
