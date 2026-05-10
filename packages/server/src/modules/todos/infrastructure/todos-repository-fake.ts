import { FakeDatabaseRelaxedLive, FakeDatabaseTag } from "@/test-utils/fake-database.js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { TodoNotFound } from "../domain/todo-errors.js";
import { type TodoId } from "../domain/todo-id.js";
import { TodosRepository } from "../domain/todo-repository.js";
import { type Todo } from "../domain/todo.js";

// Shared-state variant. See user-repository-fake.ts header.
// Todos have no FK to users in the current schema, so this fake is
// the simplest of the bunch.
export const TodosRepositoryFakeShared: Layer.Layer<TodosRepository, never, FakeDatabaseTag> =
  Layer.effect(
    TodosRepository,
    Effect.gen(function* () {
      const db = yield* FakeDatabaseTag;

      const insert = (todo: Todo) =>
        Effect.sync(() => {
          db.insertTodo(todo);
        });

      const update = (todo: Todo) =>
        db.updateTodo(todo) ? Effect.void : Effect.fail(new TodoNotFound({ todoId: todo.id }));

      const remove = (id: TodoId) =>
        db.deleteTodo(id) ? Effect.void : Effect.fail(new TodoNotFound({ todoId: id }));

      const findById = (id: TodoId) => {
        const todo = db.todos.get(id);
        return todo === undefined
          ? Effect.fail(new TodoNotFound({ todoId: id }))
          : Effect.succeed(todo);
      };

      return TodosRepository.of({ insert, update, remove, findById });
    }),
  );

export const TodosRepositoryFake = TodosRepositoryFakeShared.pipe(
  Layer.provide(FakeDatabaseRelaxedLive),
);
