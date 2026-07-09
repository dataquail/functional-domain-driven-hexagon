import { describe, it } from "@effect/vitest";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { beforeEach } from "vitest";

import { DomainEvent as makeDomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { IntegrationEventBus } from "@/platform/ddd/ports/integration-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { makeIntegrationEventBusLive } from "@/platform/integration-event-bus-live.js";
import { UnitOfWorkLive } from "@/platform/unit-of-work-live.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
// `UnitOfWorkLive` now depends on `IntegrationEventBus` (for the post-commit
// flush). Bundling them in one layer guarantees the test body's
// `yield* IntegrationEventBus` and the unit of work's flush share the SAME bus
// instance — so a handler subscribed in the test is the one the flush runs.
const UoWTestLive = UnitOfWorkLive.pipe(Layer.provideMerge(makeIntegrationEventBusLive()));

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

// A post-commit integration handler writes this marker row in its own
// transaction, so its presence/absence is the observable signal for the flush.
const markerId = "bbbbbbbb-0000-0000-0000-000000000001";
const PostCommitTestEvent = makeDomainEvent("PostCommitTestEvent", { marker: Schema.String });
const countFlush = sql.type(RowSchemas.UserRowStd)`
  SELECT * FROM "user".users WHERE id IN (${outerId}, ${markerId})
`;

const suite = describe.sequential;

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
    }).pipe(Effect.provide(UoWTestLive.pipe(Layer.provideMerge(TestDatabaseLive)))),
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
    }).pipe(Effect.provide(UoWTestLive.pipe(Layer.provideMerge(TestDatabaseLive)))),
  );

  // Proves the savepoint contract: a nested `run` opens a real SAVEPOINT, so a
  // failure inside it that the caller CATCHES rolls back only the nested write
  // while the outer transaction goes on to commit. The old flatten behavior
  // couldn't do this — without a savepoint the nested insert rode along in the
  // outer transaction and committed with it (this test would see 2 rows).
  it.effect("a caught nested failure rolls back only the savepoint while the outer commits", () =>
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

      yield* uow.run(
        Effect.gen(function* () {
          yield* insert(outerId, "outer@example.com");
          // Nested run writes then fails; we catch the failure so the outer
          // unit of work continues. The nested write must roll back to its
          // savepoint without aborting the outer transaction.
          const innerExit = yield* Effect.exit(
            uow.run(
              Effect.gen(function* () {
                yield* insert(innerId, "inner@example.com");
                return yield* Effect.fail("nested boom" as const);
              }),
            ),
          );
          deepStrictEqual(Exit.isFailure(innerExit), true);
        }),
      );

      const rows = yield* db.execute((c) => c.any(countSeeded));
      deepStrictEqual(rows.length, 1);
      deepStrictEqual(rows[0]?.id, outerId);
    }).pipe(Effect.provide(UoWTestLive.pipe(Layer.provideMerge(TestDatabaseLive)))),
  );
});

// Proves the post-commit (integration) bus contract: events dispatched to
// `IntegrationEventBus` inside a unit of work are buffered, then drained AFTER
// the transaction commits — each handler in its own transaction, its failure
// isolated, and discarded entirely if the producer rolls back.
suite("UnitOfWorkLive post-commit flush (integration)", () => {
  const insert = (db: Database.Database["Service"], id: string, email: string) =>
    db.makeQuery((execute) =>
      execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "user".users (id, email, created_at, updated_at)
          VALUES (${id}, ${email}, now(), now())
        `),
      ),
    )();

  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("drains a buffered handler after the producer commits", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const db = yield* Database.Database;
      const bus = yield* IntegrationEventBus;
      yield* bus.subscribe(PostCommitTestEvent, () =>
        insert(db, markerId, "marker@example.com").pipe(Effect.orDie),
      );

      yield* uow.run(
        Effect.gen(function* () {
          yield* insert(db, outerId, "outer@example.com");
          yield* bus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
        }),
      );

      // Both the producer row and the post-commit handler's marker row exist.
      const rows = yield* db.execute((c) => c.any(countFlush));
      deepStrictEqual(rows.length, 2);
    }).pipe(Effect.provide(UoWTestLive.pipe(Layer.provideMerge(TestDatabaseLive)))),
  );

  it.effect("a failing handler does not roll back the producer (failure isolated)", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const db = yield* Database.Database;
      const bus = yield* IntegrationEventBus;
      yield* bus.subscribe(PostCommitTestEvent, () => Effect.die("integration handler boom"));

      const exit = yield* Effect.exit(
        uow.run(
          Effect.gen(function* () {
            yield* insert(db, outerId, "outer@example.com");
            yield* bus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
          }),
        ),
      );

      // The producer's unit of work succeeded despite the handler dying...
      deepStrictEqual(Exit.isSuccess(exit), true);
      // ...and its write is committed.
      const rows = yield* db.execute((c) => c.any(countFlush));
      deepStrictEqual(rows.length, 1);
      deepStrictEqual(rows[0]?.id, outerId);
    }).pipe(Effect.provide(UoWTestLive.pipe(Layer.provideMerge(TestDatabaseLive)))),
  );

  it.effect("a producer rollback discards the buffered events (no flush)", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const db = yield* Database.Database;
      const bus = yield* IntegrationEventBus;
      yield* bus.subscribe(PostCommitTestEvent, () =>
        insert(db, markerId, "marker@example.com").pipe(Effect.orDie),
      );

      const exit = yield* Effect.exit(
        uow.run(
          Effect.gen(function* () {
            yield* insert(db, outerId, "outer@example.com");
            yield* bus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
            return yield* Effect.die("producer boom");
          }),
        ),
      );

      deepStrictEqual(Exit.isFailure(exit), true);
      // Producer rolled back AND the handler never ran (buffer discarded).
      const rows = yield* db.execute((c) => c.any(countFlush));
      deepStrictEqual(rows.length, 0);
    }).pipe(Effect.provide(UoWTestLive.pipe(Layer.provideMerge(TestDatabaseLive)))),
  );

  it.effect("a rolled-back savepoint discards integration events emitted inside it", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const db = yield* Database.Database;
      const bus = yield* IntegrationEventBus;
      yield* bus.subscribe(PostCommitTestEvent, () =>
        insert(db, markerId, "marker@example.com").pipe(Effect.orDie),
      );

      yield* uow.run(
        Effect.gen(function* () {
          yield* insert(db, outerId, "outer@example.com");
          // Nested savepoint dispatches an integration event then fails; the
          // caught failure rolls the savepoint back and truncates the buffer.
          yield* Effect.exit(
            uow.run(
              Effect.gen(function* () {
                yield* bus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
                return yield* Effect.fail("savepoint boom" as const);
              }),
            ),
          );
        }),
      );

      // Outer committed, but the integration event from the rolled-back
      // savepoint was truncated, so the handler never ran.
      const rows = yield* db.execute((c) => c.any(countFlush));
      deepStrictEqual(rows.length, 1);
      deepStrictEqual(rows[0]?.id, outerId);
    }).pipe(Effect.provide(UoWTestLive.pipe(Layer.provideMerge(TestDatabaseLive)))),
  );
});
