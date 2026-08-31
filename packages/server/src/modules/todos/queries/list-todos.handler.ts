import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import {
  type ListTodosPayload,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos.query.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const toView = (row: RowSchemas.TodoRow): ListTodosTodoView => ({
  id: TodoId.make(row.id),
  title: row.title,
  completed: row.completed,
});

export const listTodosHandler = Effect.fn("listTodosHandler")(function* (query: ListTodosPayload) {
  const sql = yield* Database.Database;
  const rows = yield* sql`
    SELECT * FROM todos.todos
    WHERE organization_id = ${query.organizationId}
    ORDER BY created_at DESC
  `.pipe(Database.rows(RowSchemas.TodoRow), translateDatabaseErrors);
  return { todos: rows.map(toView) };
});
