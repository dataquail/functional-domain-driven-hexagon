import { TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import { UserId } from "@/modules/todos/domain/user-id.js";
import {
  RecordedNotifications,
  TodosNotifierFake,
} from "@/modules/todos/infrastructure/todos-notifier-fake.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { DeleteTodoCommand } from "./delete-todo-command.js";
import { deleteTodo } from "./delete-todo.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const aliceUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const TestLayer = Layer.mergeAll(TodosRepositoryFake, TodosNotifierFake);

describe("deleteTodo", () => {
  it.effect("removes the todo from the repository", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      yield* repo.insert(Todo.create({ id: aliceId, title: "Buy milk", now }));
      yield* deleteTodo(DeleteTodoCommand.make({ todoId: aliceId, userId: aliceUserId }));
      const exit = yield* Effect.exit(repo.findById(aliceId));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TestLayer)),
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
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fires a Deleted notification with the todoId and userId after the remove", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      yield* repo.insert(Todo.create({ id: aliceId, title: "Buy milk", now }));
      const recorded = yield* RecordedNotifications;
      yield* deleteTodo(DeleteTodoCommand.make({ todoId: aliceId, userId: aliceUserId }));
      const calls = yield* recorded.all;
      deepStrictEqual(calls.length, 1);
      const call = calls[0];
      if (call?._tag !== "Deleted") throw new Error("expected Deleted");
      deepStrictEqual(call.userId, aliceUserId);
      deepStrictEqual(call.todoId, aliceId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("does not notify when the todo doesn't exist", () =>
    Effect.gen(function* () {
      const recorded = yield* RecordedNotifications;
      yield* Effect.exit(
        deleteTodo(DeleteTodoCommand.make({ todoId: aliceId, userId: aliceUserId })),
      );
      const calls = yield* recorded.all;
      deepStrictEqual(calls.length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );
});
