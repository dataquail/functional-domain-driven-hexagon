import { listTodos } from "@/modules/todos/queries/list-todos.js";
import { listTodosQuerySpanAttributes } from "@/modules/todos/queries/list-todos-query.js";
import { queryHandlers } from "@/platform/ddd/query-bus.js";

export const todoQueryHandlers = queryHandlers({
  ListTodosQuery: { handle: listTodos, spanAttributes: listTodosQuerySpanAttributes },
});
