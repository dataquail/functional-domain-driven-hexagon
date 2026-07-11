import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import {
  type ListTodosQuery,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

const toView = (row: RowSchemas.TodoRow): ListTodosTodoView => ({
  id: TodoId.make(row.id),
  title: row.title,
  completed: row.completed,
});

export const listTodos = Effect.fn("listTodos")(function* (query: ListTodosQuery) {
  const db = yield* Database.Database;
  const rows = yield* db
    .execute((client) =>
      client.any(sql.type(RowSchemas.TodoRowStd)`
          SELECT * FROM todos.todos
          WHERE organization_id = ${query.organizationId}
          ORDER BY created_at DESC
        `),
    )
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );
  return { todos: rows.map(toView) };
});
