import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";

import { findTodoOrganization } from "@/modules/todos/queries/find-todo-organization.handler.js";
import {
  type FindTodoOrganizationQuery,
  findTodoOrganizationQuerySpanAttributes,
  type TodoOrganizationView,
} from "@/modules/todos/queries/find-todo-organization.query.js";
import { listTodos } from "@/modules/todos/queries/list-todos.handler.js";
import {
  type ListTodosQuery,
  listTodosQuerySpanAttributes,
  type ListTodosResult,
} from "@/modules/todos/queries/list-todos.query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type ListTodosOutput = Effect.Effect<ListTodosResult, PersistenceUnavailable, Database.Database>;

type FindTodoOrganizationOutput = Effect.Effect<
  TodoOrganizationView | null,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    ListTodosQuery: {
      readonly query: ListTodosQuery;
      readonly output: ListTodosOutput;
    };
    FindTodoOrganizationQuery: {
      readonly query: FindTodoOrganizationQuery;
      readonly output: FindTodoOrganizationOutput;
    };
  }
}

// `ListTodosQuery` reads SQL directly so the handler doesn't need wrapping.
// Lives at module root for symmetry with `todo-command-handlers.ts`.
export const todoQueryHandlers = queryHandlers({
  ListTodosQuery: { handle: listTodos, spanAttributes: listTodosQuerySpanAttributes },
  FindTodoOrganizationQuery: {
    handle: findTodoOrganization,
    spanAttributes: findTodoOrganizationQuerySpanAttributes,
  },
});
