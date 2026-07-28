import { Query } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { findTodoOrganization } from "@/modules/todos/queries/find-todo-organization.handler.js";
import { FindTodoOrganization } from "@/modules/todos/queries/find-todo-organization.query.js";
import { listTodos } from "@/modules/todos/queries/list-todos.handler.js";
import { ListTodos } from "@/modules/todos/queries/list-todos.query.js";

const todoQueryGroup = Query.group(ListTodos, FindTodoOrganization);

const TodoQueryHandlersLive = Query.handlersOf(todoQueryGroup, {
  ListTodosQuery: (payload) => listTodos(payload),
  FindTodoOrganizationQuery: (payload) => findTodoOrganization(payload),
});

const todoQuerySpanAttributes: Query.SpanAttributes<typeof todoQueryGroup> = {
  ListTodosQuery: (payload) => ({ "organization.id": payload.organizationId }),
  FindTodoOrganizationQuery: (payload) => ({
    "query.organizationId": payload.organizationId,
    "query.todoId": payload.todoId,
  }),
};

// This module's slice of the read-side dispatch surface. See `WalletCommands` for why a
// module publishes its own surface rather than letting consumers name the bus.
export class TodoQueries extends Context.Service<
  TodoQueries,
  Query.Dispatcher<typeof todoQueryGroup>
>()("@org/server/todos/TodoQueries") {}

export const TodoQueriesLive = Layer.effect(
  TodoQueries,
  Query.dispatcher(todoQueryGroup, { spanAttributes: todoQuerySpanAttributes }),
).pipe(Layer.provide(TodoQueryHandlersLive));
