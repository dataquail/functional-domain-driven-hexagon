import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { TodoNotFound } from "../domain/todo-errors.js";
import { type TodoId } from "../domain/todo-id.js";
import { TodosRepository } from "../domain/todo-repository.js";
import { type Todo } from "../domain/todo.js";
import * as TodoMapper from "./todo-mapper.js";

export const TodosRepositoryLive = Layer.effect(
  TodosRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, todo: Todo) => {
      const row = TodoMapper.toPersistence(todo);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO todos (id, title, completed, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.title},
            ${row.completed},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.updated_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("TodosRepository.insert"),
      );
    });

    const update = db.makeQuery((execute, todo: Todo) => {
      const row = TodoMapper.toPersistence(todo);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
          UPDATE todos SET
            title = ${row.title},
            completed = ${row.completed},
            updated_at = ${sql.timestamp(row.updated_at)}
          WHERE id = ${row.id}
          RETURNING *
        `),
      ).pipe(
        orFail(() => new TodoNotFound({ todoId: todo.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("TodosRepository.update"),
      );
    });

    const remove = db.makeQuery((execute, id: TodoId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
          DELETE FROM todos WHERE id = ${id} RETURNING *
        `),
      ).pipe(
        orFail(() => new TodoNotFound({ todoId: id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("TodosRepository.remove"),
      ),
    );

    const findById = db.makeQuery((execute, id: TodoId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
          SELECT * FROM todos WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new TodoNotFound({ todoId: id })),
        Effect.map(TodoMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("TodosRepository.findById"),
      ),
    );

    return TodosRepository.of({ insert, update, remove, findById });
  }),
);
