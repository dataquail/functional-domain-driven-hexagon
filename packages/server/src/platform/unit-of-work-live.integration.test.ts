import { describe, it } from "@effect/vitest";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { beforeEach } from "vitest";

import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { UnitOfWorkLive } from "@/platform/unit-of-work-live.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

// Proves the re-entrancy contract of `UnitOfWorkLive.run`: a nested `run`
// (e.g. a command fired from inside another command's unit of work — exactly
// what auth JIT sign-in does when it provisions a user) JOINS the outer
// transaction rather than opening a second one on a foreign connection. Two
// observations: (1) both writes commit together; (2) a failure after the
// nested run rolls the nested write back too — only possible if it shared the
// transaction. Writes go through `db.makeQuery`, which resolves the ambient
// `TransactionContext` per call (the same mechanism real repositories use).

const outerId = "aaaaaaaa-0000-0000-0000-000000000001";
const innerId = "aaaaaaaa-0000-0000-0000-000000000002";

const countSeeded = sql.type(RowSchemas.UserRowStd)`
  SELECT * FROM "user".users WHERE id IN (${outerId}, ${innerId})
`;

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("UnitOfWorkLive re-entrancy (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("a nested run commits together with the outer transaction", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const db = yield* Database.Database;
      // tx-aware insert (joins the ambient TransactionContext, like real repos)
      const insert = (id: string, email: string) =>
        db.makeQuery((execute) =>
          execute((c) =>
            c.query(sql.unsafe`
              INSERT INTO "user".users (id, email, created_at, updated_at)
              VALUES (${id}, ${email}, now(), now())
            `),
          ),
        )();

      yield* uow.run(
        Effect.gen(function* () {
          yield* insert(outerId, "outer@example.com");
          // Nested run: must join the outer tx (no second connection).
          yield* uow.run(insert(innerId, "inner@example.com"));
        }),
      );
      const rows = yield* db.execute((c) => c.any(countSeeded));
      deepStrictEqual(rows.length, 2);
    }).pipe(Effect.provide(UnitOfWorkLive), Effect.provide(TestDatabaseLive)),
  );

  it.effect("a failure after a nested run rolls back the nested write too", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const db = yield* Database.Database;
      const insert = (id: string, email: string) =>
        db.makeQuery((execute) =>
          execute((c) =>
            c.query(sql.unsafe`
              INSERT INTO "user".users (id, email, created_at, updated_at)
              VALUES (${id}, ${email}, now(), now())
            `),
          ),
        )();

      const exit = yield* Effect.exit(
        uow.run(
          Effect.gen(function* () {
            yield* insert(outerId, "outer@example.com");
            yield* uow.run(insert(innerId, "inner@example.com"));
            // Fail the outer unit of work after the nested write. If the
            // nested run had opened its own transaction, `innerId` would
            // survive this rollback.
            return yield* Effect.die("boom");
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      const rows = yield* db.execute((c) => c.any(countSeeded));
      deepStrictEqual(rows.length, 0);
    }).pipe(Effect.provide(UnitOfWorkLive), Effect.provide(TestDatabaseLive)),
  );
});
