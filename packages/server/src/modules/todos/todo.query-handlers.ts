import { Query } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { findTodoOrganizationHandler } from "@/modules/todos/queries/find-todo-organization.handler";
import { FindTodoOrganizationQuery } from "@/modules/todos/queries/find-todo-organization.query";
import { listTodosHandler } from "@/modules/todos/queries/list-todos.handler";
import { ListTodosQuery } from "@/modules/todos/queries/list-todos.query";

export const todoQueryGroup = Query.group(ListTodosQuery, FindTodoOrganizationQuery);

const TodoQueryHandlersLive = Query.handlersOf(todoQueryGroup, {
  ListTodosQuery: (payload) => listTodosHandler(payload),
  FindTodoOrganizationQuery: (payload) => findTodoOrganizationHandler(payload),
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
