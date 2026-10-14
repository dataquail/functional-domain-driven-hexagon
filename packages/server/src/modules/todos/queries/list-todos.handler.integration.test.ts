import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { TodoId } from "@/modules/todos/domain/todo/todo.id";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/repositories/todos.repository-live";
import { listTodosHandler } from "@/modules/todos/queries/list-todos.handler";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const carolId = TodoId.make("33333333-3333-3333-3333-333333333333");
const orgA = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgB = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const aliceTime = DateTime.makeUnsafe("2025-01-01T00:00:00Z");
const bobTime = DateTime.makeUnsafe("2025-02-01T00:00:00Z");
const carolTime = DateTime.makeUnsafe("2025-03-01T00:00:00Z");

const TestLayer = TodosRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

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

const seed = (id: TodoId, organizationId: OrganizationId, title: string, now: DateTime.Utc) =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    yield* repo.insertOne(TodoRootOps.create({ id, organizationId, title, now }));
  });

describeIntegration(
  "listTodosHandler (integration)",
  { layer: TestLayer, tables: ["todos.todos", "organization.organizations"] },
  (it) => {
    it.effect("returns only the requested org's rows, ordered by created_at desc", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        yield* seed(aliceId, orgA, "alice", aliceTime);
        yield* seed(bobId, orgA, "bob", bobTime);
        yield* seed(carolId, orgB, "carol-in-org-b", carolTime);

        const result = yield* listTodosHandler({ organizationId: orgA });
        deepStrictEqual(
          result.todos.map((t) => t.title),
          ["bob", "alice"],
        );
      }),
    );

    it.effect("returns empty for an org with no todos", () =>
      Effect.gen(function* () {
        yield* seedOrgs;
        yield* seed(aliceId, orgA, "alice", aliceTime);
        const result = yield* listTodosHandler({ organizationId: orgB });
        deepStrictEqual(result.todos, []);
      }),
    );
  },
);
