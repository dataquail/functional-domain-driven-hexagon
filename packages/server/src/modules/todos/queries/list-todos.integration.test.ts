import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/todos-repository-live.js";
import { ListTodosQuery } from "@/modules/todos/queries/list-todos-query.js";
import { listTodos } from "@/modules/todos/queries/list-todos.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const carolId = TodoId.make("33333333-3333-3333-3333-333333333333");

const aliceTime = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const bobTime = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));
const carolTime = DateTime.unsafeMake(new Date("2025-03-01T00:00:00Z"));

const TestLayer = TodosRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seed = (id: TodoId, title: string, now: DateTime.Utc) =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    yield* repo.insert(Todo.create({ id, title, now }));
  });

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("listTodos (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("todos").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("returns rows ordered by created_at desc", () =>
    Effect.gen(function* () {
      yield* seed(aliceId, "alice", aliceTime);
      yield* seed(bobId, "bob", bobTime);
      yield* seed(carolId, "carol", carolTime);

      const result = yield* listTodos(ListTodosQuery.make({}));
      deepStrictEqual(
        result.todos.map((t) => t.title),
        ["carol", "bob", "alice"],
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns empty when the table is empty", () =>
    Effect.gen(function* () {
      const result = yield* listTodos(ListTodosQuery.make({}));
      deepStrictEqual(result.todos, []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
