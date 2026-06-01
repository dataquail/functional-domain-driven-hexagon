import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import { TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/todos-repository-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const orgA = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgB = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));

const buyMilk = Todo.create({ id: aliceId, organizationId: orgA, title: "Buy milk", now });

// todos.todos.organization_id FKs to organization.organizations(id);
// seed both orgs via raw SQL since the todos repo can't (and shouldn't)
// reach the org module's internals.
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

const TestLayer = TodosRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("TodosRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("todos.todos", "organization.organizations").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  describe("insert", () => {
    it.effect("persists the todo with its org and decodes it back via findById", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const found = yield* repo.findById(orgA, buyMilk.id);
        deepStrictEqual(found.id, buyMilk.id);
        deepStrictEqual(found.organizationId, orgA);
        deepStrictEqual(found.title, buyMilk.title);
        deepStrictEqual(found.completed, false);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findById", () => {
    it.effect("fails TodoNotFound for an unknown id", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.findById(orgA, bobId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails TodoNotFound when the todo belongs to another org (tenant isolation)", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const exit = yield* Effect.exit(repo.findById(orgB, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("update", () => {
    it.effect("overwrites title/completed and updatedAt", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const completed = Todo.update(buyMilk, {
          title: "Buy oat milk",
          completed: true,
          now: later,
        });
        yield* repo.update(completed);
        const found = yield* repo.findById(orgA, buyMilk.id);
        deepStrictEqual(found.title, "Buy oat milk");
        deepStrictEqual(found.completed, true);
        deepStrictEqual(
          DateTime.toDate(found.updatedAt).toISOString(),
          DateTime.toDate(later).toISOString(),
        );
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails TodoNotFound when the todo isn't stored", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.update(buyMilk));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("remove", () => {
    it.effect("deletes the row", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        yield* repo.remove(orgA, buyMilk.id);
        const exit = yield* Effect.exit(repo.findById(orgA, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails TodoNotFound (and leaves the row) when removing from the wrong org", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const exit = yield* Effect.exit(repo.remove(orgB, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
        const found = yield* repo.findById(orgA, buyMilk.id);
        deepStrictEqual(found.id, buyMilk.id);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails TodoNotFound when the todo isn't stored", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.remove(orgA, bobId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("transaction", () => {
    it.effect("rolls back inserts when the body fails (surfaces typed error)", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        const repo = yield* TodosRepository;
        const db = yield* Database.Database;
        const exit = yield* Effect.exit(
          db.transaction((tx) =>
            Effect.gen(function* () {
              yield* repo.insert(buyMilk).pipe(Database.TransactionContext.provide(tx));
              return yield* Effect.fail(new TodoNotFound({ todoId: bobId }));
            }),
          ),
        );
        deepStrictEqual(Exit.isFailure(exit), true);
        const after = yield* Effect.exit(repo.findById(orgA, buyMilk.id));
        deepStrictEqual(Exit.isFailure(after), true);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
