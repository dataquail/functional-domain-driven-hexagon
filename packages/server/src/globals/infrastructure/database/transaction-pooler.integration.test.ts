import { deepStrictEqual } from "node:assert";

import { makeUnitOfWork, UnitOfWork } from "@effect-server-utils/unit-of-work";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { TransactionDriverLive } from "@/globals/infrastructure/database/transaction-driver-live.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestPooledDatabaseLive } from "@/test-utils/test-database.ts";

const PooledLive = makeUnitOfWork().pipe(
  Layer.provide(TransactionDriverLive),
  Layer.provideMerge(TestPooledDatabaseLive),
);

const CountRow = Schema.Struct({ count: Schema.Finite });

const insertRole = (userId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database.Database;
    yield* sql`
      INSERT INTO platform.roles (user_id, role) VALUES (${userId}, 'super_admin')
    `.pipe(Database.exec, Effect.orDie);
  });

const roleCount = Effect.gen(function* () {
  const sql = yield* Database.Database;

  const row = yield* sql`SELECT count(*)::int AS count FROM platform.roles`.pipe(
    Database.row(CountRow),
    Effect.orDie,
  );

  return row.count;
});

const firstUserId = "cccccccc-0000-0000-0000-000000000001";
const secondUserId = "cccccccc-0000-0000-0000-000000000002";
const userIds = [firstUserId, secondUserId];

const seedUsers = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* Effect.forEach(userIds, (id) =>
    sql`
      INSERT INTO "user".users (id, email) VALUES (${id}, ${`${id}@example.com`})
    `.pipe(Database.exec, Effect.orDie),
  );
});

describeIntegration(
  "Database behind a transaction-mode pooler",
  { layer: PooledLive, tables: ["platform.roles", "user.users"] },
  (it) => {
    it.effect("repeats a statement without a named prepared statement to reuse", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        const counts = yield* Effect.forEach([1, 2, 3], () => roleCount);
        deepStrictEqual(counts, [0, 0, 0]);
      }),
    );

    it.effect("commits a unit of work with a nested savepoint", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        const uow = yield* UnitOfWork;
        yield* uow.run(
          Effect.gen(function* () {
            yield* insertRole(firstUserId);
            yield* uow.run(insertRole(secondUserId));
          }),
        );
        deepStrictEqual(yield* roleCount, 2);
      }),
    );

    it.effect("runs concurrent statements on its two connections", () =>
      Effect.gen(function* () {
        yield* seedUsers;

        const counts = yield* Effect.all([roleCount, roleCount, roleCount, roleCount], {
          concurrency: "unbounded",
        });

        deepStrictEqual(counts, [0, 0, 0, 0]);
      }),
    );
  },
);
