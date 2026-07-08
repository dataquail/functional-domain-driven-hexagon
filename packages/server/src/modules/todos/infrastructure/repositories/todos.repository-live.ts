import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { type TodoId } from "@/modules/todos/domain/todo.id.js";
import { type TodoRoot } from "@/modules/todos/domain/todo.root.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as TodoMapper from "./todo.mapper.js";

export const TodosRepositoryLive = Layer.effect(
  TodosRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, todo: TodoRoot) => {
      const row = TodoMapper.toPersistence(todo);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.organization_id},
            ${row.title},
            ${row.completed},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.updated_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("TodosRepository.insertOne"),
      );
    });

    // Scoped on organization_id as well as id: an update aimed at a todo
    // in another org matches no row and surfaces as TodoNotFound.
    const updateOne = db.makeQuery((execute, todo: TodoRoot) => {
      const row = TodoMapper.toPersistence(todo);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
          UPDATE todos.todos SET
            title = ${row.title},
            completed = ${row.completed},
            updated_at = ${sql.timestamp(row.updated_at)}
          WHERE id = ${row.id} AND organization_id = ${row.organization_id}
          RETURNING *
        `),
      ).pipe(
        orFail(() => new TodoNotFound({ todoId: todo.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("TodosRepository.updateOne"),
      );
    });

    const remove = db.makeQuery((execute, args: { organizationId: OrganizationId; id: TodoId }) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
            DELETE FROM todos.todos
            WHERE id = ${args.id} AND organization_id = ${args.organizationId}
            RETURNING *
          `),
      ).pipe(
        orFail(() => new TodoNotFound({ todoId: args.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("TodosRepository.deleteOne"),
      ),
    );

    const findOneById = db.makeQuery(
      (execute, args: { organizationId: OrganizationId; id: TodoId }) =>
        execute((client) =>
          client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
            SELECT * FROM todos.todos
            WHERE id = ${args.id} AND organization_id = ${args.organizationId}
          `),
        ).pipe(
          orFail(() => new TodoNotFound({ todoId: args.id })),
          Effect.map(TodoMapper.toDomain),
          Effect.catchTag("DatabaseError", Effect.die),
          translatePersistenceUnavailable,
          Effect.withSpan("TodosRepository.findOneById"),
        ),
    );

    return TodosRepository.of({
      insertOne,
      updateOne,
      deleteOne: (organizationId, id) => remove({ organizationId, id }),
      findOneById: (organizationId, id) => findOneById({ organizationId, id }),
    });
  }),
);
