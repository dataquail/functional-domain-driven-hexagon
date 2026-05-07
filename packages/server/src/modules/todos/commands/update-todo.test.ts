import { TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { UpdateTodoCommand } from "./update-todo-command.js";
import { updateTodo } from "./update-todo.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const aliceUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const seed = Effect.gen(function* () {
  const repo = yield* TodosRepository;
  const todo = Todo.create({ id: aliceId, title: "Buy milk", now });
  yield* repo.insert(todo);
});

describe("updateTodo", () => {
  it.effect("overwrites title and completed and returns the updated todo", () =>
    Effect.gen(function* () {
      yield* seed;
      const updated = yield* updateTodo(
        UpdateTodoCommand.make({
          todoId: aliceId,
          title: "Buy oat milk",
          completed: true,
          userId: aliceUserId,
        }),
      );
      deepStrictEqual(updated.title, "Buy oat milk");
      deepStrictEqual(updated.completed, true);

      const repo = yield* TodosRepository;
      const stored = yield* repo.findById(aliceId);
      deepStrictEqual(stored.title, "Buy oat milk");
      deepStrictEqual(stored.completed, true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound when the todo doesn't exist", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        updateTodo(
          UpdateTodoCommand.make({
            todoId: aliceId,
            title: "x",
            completed: false,
            userId: aliceUserId,
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof TodoNotFound, true);
      }
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
