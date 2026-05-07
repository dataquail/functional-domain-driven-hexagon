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
import { DeleteTodoCommand } from "./delete-todo-command.js";
import { deleteTodo } from "./delete-todo.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const aliceUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

describe("deleteTodo", () => {
  it.effect("removes the todo from the repository", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      yield* repo.insert(Todo.create({ id: aliceId, title: "Buy milk", now }));
      yield* deleteTodo(DeleteTodoCommand.make({ todoId: aliceId, userId: aliceUserId }));
      const exit = yield* Effect.exit(repo.findById(aliceId));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound when the todo doesn't exist", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        deleteTodo(DeleteTodoCommand.make({ todoId: aliceId, userId: aliceUserId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof TodoNotFound, true);
      }
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
