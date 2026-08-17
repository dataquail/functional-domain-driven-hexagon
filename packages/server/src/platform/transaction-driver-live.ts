import {
  PersistenceUnavailable,
  TransactionDriver,
  TransactionFailed,
} from "@effect-server-utils/cqrs";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

// The slonik binding for the atomicity primitive `@effect-server-utils/cqrs` needs. This is the
// only file that knows a unit of work is implemented as a SQL transaction; the
// boundary's semantics live in the package.
//
// Both scopes make the scoped client ambient as a `TransactionContext`, which is
// what a repository's `makeQuery` picks up to join the scope rather than taking a
// fresh pool connection.
export const TransactionDriverLive: Layer.Layer<TransactionDriver, never, Database.Database> =
  Layer.effect(
    TransactionDriver,
    Effect.gen(function* () {
      const db = yield* Database.Database;

      // `catchTag` widens the caught value to a structural match on `_tag`,
      // because the caller's own `E` could contain a different type carrying the
      // same tag. These came from `db.*`, so the casts carry that knowledge
      // across the inference gap.
      const translate = <A, E, R>(
        effect: Effect.Effect<A, E | Database.DatabaseError | Database.DatabaseUnavailable, R>,
      ): Effect.Effect<A, E | TransactionFailed | PersistenceUnavailable, R> =>
        effect.pipe(
          Effect.catchTag(
            "DatabaseError",
            (error) =>
              new TransactionFailed({ message: (error as Database.DatabaseError).message }),
          ),
          Effect.catchTag(
            "DatabaseUnavailable",
            (error) =>
              new PersistenceUnavailable({
                message: (error as Database.DatabaseUnavailable).message,
              }),
          ),
        );

      return TransactionDriver.of({
        withTransaction: (effect) =>
          translate(db.transaction((tx) => effect.pipe(Database.TransactionContext.provide(tx)))),

        // Slonik implements a nested transaction as SAVEPOINT, and `db.savepoint`
        // reads the enclosing transaction from context. Resolving it with
        // `serviceOption` and providing it back is what keeps `TransactionContext`
        // out of this driver's requirement channel — the port promises callers an
        // untouched `R`.
        withSavepoint: (effect) =>
          Effect.serviceOption(Database.TransactionContext).pipe(
            Effect.flatMap((enclosing) =>
              Option.isNone(enclosing)
                ? Effect.die(
                    new Error(
                      "TransactionDriver.withSavepoint called with no enclosing transaction",
                    ),
                  )
                : translate(
                    db
                      .savepoint((savepoint) =>
                        effect.pipe(Database.TransactionContext.provide(savepoint)),
                      )
                      .pipe(Database.TransactionContext.provide(enclosing.value)),
                  ),
            ),
          ),

        isActive: Effect.serviceOption(Database.TransactionContext).pipe(Effect.map(Option.isSome)),
      });
    }),
  );
