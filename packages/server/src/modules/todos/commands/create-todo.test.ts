import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import { CreateTodoCommand } from "./create-todo-command.js";
import { createTodo } from "./create-todo.js";

const aliceUserId = UserId.make("11111111-1111-1111-1111-111111111111");

describe("createTodo", () => {
  it.effect("inserts a todo with completed=false and returns it", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      const todo = yield* createTodo(
        CreateTodoCommand.make({ title: "Buy milk", userId: aliceUserId }),
      );
      deepStrictEqual(todo.title, "Buy milk");
      deepStrictEqual(todo.completed, false);
      const stored = yield* repo.findById(todo.id);
      deepStrictEqual(stored.title, "Buy milk");
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("each call gets a unique id", () =>
    Effect.gen(function* () {
      const a = yield* createTodo(CreateTodoCommand.make({ title: "A", userId: aliceUserId }));
      const b = yield* createTodo(CreateTodoCommand.make({ title: "B", userId: aliceUserId }));
      deepStrictEqual(a.id === b.id, false);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
