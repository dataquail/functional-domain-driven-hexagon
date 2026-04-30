import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import {
  RecordedNotifications,
  TodosNotifierFake,
} from "@/modules/todos/infrastructure/todos-notifier-fake.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CreateTodoCommand } from "./create-todo-command.js";
import { createTodo } from "./create-todo.js";

const TestLayer = Layer.mergeAll(TodosRepositoryFake, TodosNotifierFake);

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
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("each call gets a unique id", () =>
    Effect.gen(function* () {
      const a = yield* createTodo(CreateTodoCommand.make({ title: "A", userId: aliceUserId }));
      const b = yield* createTodo(CreateTodoCommand.make({ title: "B", userId: aliceUserId }));
      deepStrictEqual(a.id === b.id, false);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "fires exactly one Upserted notification carrying the new todo and userId after the insert",
    () =>
      Effect.gen(function* () {
        const recorded = yield* RecordedNotifications;
        const todo = yield* createTodo(
          CreateTodoCommand.make({
            title: "Buy milk",
            userId: aliceUserId,
            optimisticId: "opt-1",
          }),
        );
        const calls = yield* recorded.all;
        deepStrictEqual(calls.length, 1);
        const call = calls[0];
        if (call?._tag !== "Upserted") throw new Error("expected Upserted");
        deepStrictEqual(call.userId, aliceUserId);
        deepStrictEqual(call.todo.id, todo.id);
        deepStrictEqual(call.todo.title, "Buy milk");
        deepStrictEqual(call.optimisticId, "opt-1");
      }).pipe(Effect.provide(TestLayer)),
  );
});
