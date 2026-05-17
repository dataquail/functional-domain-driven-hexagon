import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

// Production binding for the `UnitOfWork` port: opens a SQL transaction
// for every `run`, provides `Database.TransactionContext` to the inner
// effect so repository calls join the same transaction, and propagates a
// rollback if anything inside fails — including a synchronously-dispatched
// domain-event handler (ADR-0007). Tests that don't need a database wire
// `IdentityUnitOfWork` from `test-utils/` instead.
export const UnitOfWorkLive: Layer.Layer<UnitOfWork, never, Database.Database> = Layer.effect(
  UnitOfWork,
  Effect.gen(function* () {
    const db = yield* Database.Database;
    return UnitOfWork.of({
      run: (effect) => db.transaction((tx) => effect.pipe(Database.TransactionContext.provide(tx))),
    });
  }),
);
