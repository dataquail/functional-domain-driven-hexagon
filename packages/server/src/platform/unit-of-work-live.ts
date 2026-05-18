import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

// Production binding for the `UnitOfWork` port: opens a SQL transaction
// for every `run`, provides `Database.TransactionContext` to the inner
// effect so repository calls join the same transaction, and propagates a
// rollback if anything inside fails — including a synchronously-dispatched
// domain-event handler (ADR-0007). Tests that don't need a database wire
// `IdentityUnitOfWork` from `test-utils/` instead.
//
// The `DatabaseUnavailable` translation happens here so commands and
// event-handlers downstream only see `PersistenceUnavailable` (the
// domain-language port-level signal). Without it, calling code would
// need to know about `@org/database`'s specific error tag — leaking
// the SQL implementation through the typed channel.
export const UnitOfWorkLive: Layer.Layer<UnitOfWork, never, Database.Database> = Layer.effect(
  UnitOfWork,
  Effect.gen(function* () {
    const db = yield* Database.Database;
    return UnitOfWork.of({
      run: (effect) =>
        db
          .transaction((tx) => effect.pipe(Database.TransactionContext.provide(tx)))
          .pipe(
            // `catchTag` widens `e` to `{ _tag: "DatabaseUnavailable" }` because
            // the generic `E` from the caller could include any shape with
            // that tag. We runtime-guarantee `e` is the real
            // `Database.DatabaseUnavailable` (it came from
            // `db.transaction`); the local cast carries that knowledge
            // across the inference gap.
            Effect.catchTag("DatabaseUnavailable", (e) =>
              Effect.fail(
                new PersistenceUnavailable({
                  message: (e as Database.DatabaseUnavailable).message,
                }),
              ),
            ),
          ),
    });
  }),
);
