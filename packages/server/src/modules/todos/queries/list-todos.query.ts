import { PersistenceUnavailable, Query } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const ListTodosTodoView = Schema.Struct({
  id: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
});
export type ListTodosTodoView = typeof ListTodosTodoView.Type;

export const ListTodosResultView = Schema.Struct({
  todos: Schema.Array(ListTodosTodoView),
});
export type ListTodosResult = typeof ListTodosResultView.Type;

export const ListTodosQuery = Query.make("ListTodosQuery", {
  payload: { organizationId: OrganizationId },
  success: ListTodosResultView,
  failure: PersistenceUnavailable,
});
export type ListTodosPayload = Query.Payload<typeof ListTodosQuery>;
