import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/todos-repository-live.js";
import { listTodos } from "@/modules/todos/queries/list-todos.js";
import { ListTodosQuery } from "@/modules/todos/queries/list-todos-query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const carolId = TodoId.make("33333333-3333-3333-3333-333333333333");
const orgA = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgB = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const aliceTime = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const bobTime = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));
const carolTime = DateTime.unsafeMake(new Date("2025-03-01T00:00:00Z"));

const TestLayer = TodosRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedOrgs = Effect.gen(function* () {
  const db = yield* Database.Database;
  for (const [id, name] of [
    [orgA, "Acme"],
    [orgB, "Beta"],
  ] as const) {
    yield* db
      .execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${id}, ${name}, now(), now(), null)
        `),
      )
      .pipe(Effect.orDie);
  }
});

const seed = (id: TodoId, organizationId: OrganizationId, title: string, now: DateTime.Utc) =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    yield* repo.insert(Todo.create({ id, organizationId, title, now }));
  });

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("listTodos (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("todos.todos", "organization.organizations").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("returns only the requested org's rows, ordered by created_at desc", () =>
    Effect.gen(function* () {
      yield* seedOrgs;
      yield* seed(aliceId, orgA, "alice", aliceTime);
      yield* seed(bobId, orgA, "bob", bobTime);
      yield* seed(carolId, orgB, "carol-in-org-b", carolTime);

      const result = yield* listTodos(ListTodosQuery.make({ organizationId: orgA }));
      deepStrictEqual(
        result.todos.map((t) => t.title),
        ["bob", "alice"],
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns empty for an org with no todos", () =>
    Effect.gen(function* () {
      yield* seedOrgs;
      yield* seed(aliceId, orgA, "alice", aliceTime);
      const result = yield* listTodos(ListTodosQuery.make({ organizationId: orgB }));
      deepStrictEqual(result.todos, []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
