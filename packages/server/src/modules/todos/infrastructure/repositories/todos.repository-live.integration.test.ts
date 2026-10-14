import { deepStrictEqual } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { Spec } from "@/globals/application/ddd/specification.ts";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.ts";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.ts";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.ts";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.ts";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.ts";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/repositories/todos.repository-live.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const orgA = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgB = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2025-02-01T00:00:00Z");

const buyMilk = TodoRootOps.create({ id: aliceId, organizationId: orgA, title: "Buy milk", now });

const byOrgAndId = (organizationId: OrganizationId, id: TodoId) =>
  Spec.and(TodoSpecifications.withId(id), TodoSpecifications.forOrganization(organizationId));

// todos.todos.organization_id FKs to organization.organizations(id);
// seed both orgs via raw SQL since the todos repo can't (and shouldn't)
// reach the org module's internals.
const seedOrgs = Effect.gen(function* () {
  const sql = yield* Database.Database;

  for (const [id, name] of [
    [orgA, "Acme"],
    [orgB, "Beta"],
  ] as const) {
    yield* sql`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${id}, ${name}, now(), now(), null)
        `.pipe(Effect.orDie);
  }
});

const TestLayer = TodosRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "TodosRepositoryLive (integration)",
  { layer: TestLayer, tables: ["todos.todos", "organization.organizations"] },
  (it) => {
    describe("insert", () => {
      it.effect("persists the todo with its org and decodes it back via findOne", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          yield* repo.insertOne(buyMilk);

          const found = yield* Effect.map(
            repo.findOne(byOrgAndId(orgA, buyMilk.id)),
            Option.getOrThrow,
          );

          deepStrictEqual(found.id, buyMilk.id);
          deepStrictEqual(found.organizationId, orgA);
          deepStrictEqual(found.title, buyMilk.title);
          deepStrictEqual(found.completed, false);
        }),
      );
    });

    describe("findOne", () => {
      it.effect("returns null for an unknown id", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          const found = yield* repo.findOne(byOrgAndId(orgA, bobId));
          assertNone(found);
        }),
      );

      it.effect("returns null when the todo belongs to another org (tenant isolation)", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          yield* repo.insertOne(buyMilk);
          const found = yield* repo.findOne(byOrgAndId(orgB, buyMilk.id));
          assertNone(found);
        }),
      );
    });

    describe("update", () => {
      it.effect("overwrites title/completed and updatedAt", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          yield* repo.insertOne(buyMilk);

          const completed = TodoRootOps.update(buyMilk, {
            title: "Buy oat milk",
            completed: true,
            now: later,
          });

          yield* repo.updateOne(completed);

          const found = yield* Effect.map(
            repo.findOne(byOrgAndId(orgA, buyMilk.id)),
            Option.getOrThrow,
          );

          deepStrictEqual(found.title, "Buy oat milk");
          deepStrictEqual(found.completed, true);
          deepStrictEqual(
            DateTime.toDate(found.updatedAt).toISOString(),
            DateTime.toDate(later).toISOString(),
          );
        }),
      );

      it.effect("fails TodoNotFound when the todo isn't stored", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          const error = yield* Effect.flip(repo.updateOne(buyMilk));

          deepStrictEqual(Schema.is(TodoNotFound)(error), true);
        }),
      );
    });

    describe("remove", () => {
      it.effect("deletes the row", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          yield* repo.insertOne(buyMilk);
          yield* repo.deleteOne(orgA, buyMilk.id);
          const found = yield* repo.findOne(byOrgAndId(orgA, buyMilk.id));
          assertNone(found);
        }),
      );

      it.effect("fails TodoNotFound (and leaves the row) when removing from the wrong org", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          yield* repo.insertOne(buyMilk);
          const error = yield* Effect.flip(repo.deleteOne(orgB, buyMilk.id));

          deepStrictEqual(Schema.is(TodoNotFound)(error), true);

          const found = yield* Effect.map(
            repo.findOne(byOrgAndId(orgA, buyMilk.id)),
            Option.getOrThrow,
          );

          deepStrictEqual(found.id, buyMilk.id);
        }),
      );

      it.effect("fails TodoNotFound when the todo isn't stored", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          const error = yield* Effect.flip(repo.deleteOne(orgA, bobId));

          deepStrictEqual(Schema.is(TodoNotFound)(error), true);
        }),
      );
    });

    describe("transaction", () => {
      it.effect("rolls back inserts when the body fails (surfaces typed error)", () =>
        Effect.gen(function* () {
          yield* seedOrgs;
          const repo = yield* TodosRepository;
          const sql = yield* Database.Database;

          const exit = yield* Effect.exit(
            sql.withTransaction(
              Effect.gen(function* () {
                yield* repo.insertOne(buyMilk);

                return yield* new TodoNotFound({ todoId: bobId });
              }),
            ),
          );

          deepStrictEqual(Exit.isFailure(exit), true);
          const after = yield* repo.findOne(byOrgAndId(orgA, buyMilk.id));
          assertNone(after);
        }),
      );
    });
  },
);
