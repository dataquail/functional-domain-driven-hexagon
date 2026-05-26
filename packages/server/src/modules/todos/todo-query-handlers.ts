import { listTodos } from "@/modules/todos/queries/list-todos.js";
import { listTodosQuerySpanAttributes } from "@/modules/todos/queries/list-todos-query.js";
import { queryHandlers } from "@/platform/ddd/query-bus.js";

// `ListTodosQuery` reads SQL directly so the handler doesn't need wrapping.
// Lives at module root for symmetry with `todo-command-handlers.ts`.
export const todoQueryHandlers = queryHandlers({
  ListTodosQuery: { handle: listTodos, spanAttributes: listTodosQuerySpanAttributes },
});
