import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { type TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { type TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as TodoMapper from "./todo.mapper.js";

export const TodosRepositoryLive = Layer.effect(
  TodosRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("TodosRepository.insertOne")((todo: TodoRoot) => {
      const row = TodoMapper.toPersistence(todo);
      return sql`
        INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
        VALUES (
          ${row.id},
          ${row.organization_id},
          ${row.title},
          ${row.completed},
          ${row.created_at},
          ${row.updated_at}
        )
      `.pipe(Database.exec, translateDatabaseErrors);
    });

    // Scoped on organization_id as well as id: an update aimed at a todo
    // in another org matches no row and surfaces as TodoNotFound.
    const updateOne = Effect.fn("TodosRepository.updateOne")((todo: TodoRoot) => {
      const row = TodoMapper.toPersistence(todo);
      return sql`
        UPDATE todos.todos SET
          title = ${row.title},
          completed = ${row.completed},
          updated_at = ${row.updated_at}
        WHERE id = ${row.id} AND organization_id = ${row.organization_id}
        RETURNING *
      `.pipe(
        Database.maybeRow(RowSchemas.TodoRow),
        orFail(() => new TodoNotFound({ todoId: todo.id })),
        Effect.asVoid,
        translateDatabaseErrors,
      );
    });

    const deleteOne = Effect.fn("TodosRepository.deleteOne")(
      (organizationId: OrganizationId, id: TodoId) =>
        sql`
          DELETE FROM todos.todos
          WHERE id = ${id} AND organization_id = ${organizationId}
          RETURNING *
        `.pipe(
          Database.maybeRow(RowSchemas.TodoRow),
          orFail(() => new TodoNotFound({ todoId: id })),
          Effect.asVoid,
          translateDatabaseErrors,
        ),
    );

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne pins
    // the (id, organization_id) primary key, selecting at most one row.
    const findOne = Effect.fn("TodosRepository.findOne")((spec: Specification<TodoRoot>) =>
      sql`
        SELECT * FROM todos.todos
        WHERE ${criteriaToWhere(sql, spec.criteria, TodoMapper.columns)}
        LIMIT 1
      `.pipe(
        Database.maybeRow(RowSchemas.TodoRow),
        Effect.map((row) => (row === null ? null : TodoMapper.toDomain(row))),
        translateDatabaseErrors,
      ),
    );

    return TodosRepository.of({ insertOne, updateOne, deleteOne, findOne });
  }),
);
