import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { type TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { type TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
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

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne pins
    // the (id, organization_id) primary key, selecting at most one row.
    const findOne = db.makeQuery((execute, spec: Specification<TodoRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
          SELECT * FROM todos.todos
          WHERE ${criteriaToWhere(spec.criteria, TodoMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : TodoMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("TodosRepository.findOne"),
      ),
    );

    return TodosRepository.of({
      insertOne,
      updateOne,
      deleteOne: (organizationId, id) => remove({ organizationId, id }),
      findOne,
    });
  }),
);
