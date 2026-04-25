import { Database } from "@org/database/index";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Wraps a unit of work so every repository call inside it joins the same
// SQL transaction, and so synchronously-dispatched domain event handlers
// inherit that transaction via `TransactionContext`. Production binds this
// to `db.transaction(...)`; tests can swap in an identity implementation
// that doesn't touch a database.
export interface TransactionRunnerShape {
  readonly run: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | Database.DatabaseError, Exclude<R, Database.TransactionContext>>;
}

export class TransactionRunner extends Context.Tag("TransactionRunner")<
  TransactionRunner,
  TransactionRunnerShape
>() {}

export const TransactionRunnerLive: Layer.Layer<TransactionRunner, never, Database.Database> =
  Layer.effect(
    TransactionRunner,
    Effect.gen(function* () {
      const db = yield* Database.Database;
      return TransactionRunner.of({
        run: (effect) =>
          db.transaction((tx) => effect.pipe(Database.TransactionContext.provide(tx))),
      });
    }),
  );
