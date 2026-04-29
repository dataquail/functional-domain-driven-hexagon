import { listTodosQuerySpanAttributes } from "@/modules/todos/queries/list-todos-query.js";
import { listTodos } from "@/modules/todos/queries/list-todos.js";
import { queryHandlers } from "@/platform/query-bus.js";

export const todoQueryHandlers = queryHandlers({
  ListTodosQuery: { handle: listTodos, spanAttributes: listTodosQuerySpanAttributes },
});
