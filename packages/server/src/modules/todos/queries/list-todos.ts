import { TodoId } from "@/modules/todos/domain/todo-id.js";
import {
  type ListTodosOutput,
  type ListTodosQuery,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos-query.js";
import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

const toView = (row: RowSchemas.TodoRow): ListTodosTodoView => ({
  id: TodoId.make(row.id),
  title: row.title,
  completed: row.completed,
});

export const listTodos = (_query: ListTodosQuery): ListTodosOutput =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const rows = yield* db
      .execute((client) =>
        client.any(sql.type(RowSchemas.TodoRowStd)`
          SELECT * FROM todos ORDER BY created_at DESC
        `),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    return { todos: rows.map(toView) };
  });
