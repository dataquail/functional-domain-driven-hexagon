import {
  PersistenceUnavailable,
  TransactionDriver,
  TransactionFailed,
} from "@effect-server-utils/unit-of-work";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

// The SQL binding for the atomicity primitive `@effect-server-utils/unit-of-work`
// needs. This is the only file that knows a unit of work is implemented as a SQL
// transaction; the boundary's semantics live in the package.
export const TransactionDriverLive: Layer.Layer<TransactionDriver, never, Database.Database> =
  Layer.effect(
    TransactionDriver,
    Effect.gen(function* () {
      const sql = yield* Database.Database;

      const translateDatabaseFailure = <E>(
        error: E | Database.DatabaseError | Database.DatabaseUnavailable,
      ): E | TransactionFailed | PersistenceUnavailable =>
        error instanceof Database.DatabaseError
          ? new TransactionFailed({ message: error.message })
          : error instanceof Database.DatabaseUnavailable
            ? new PersistenceUnavailable({ message: error.message })
            : error;

      // The client is depth-aware: the outermost call emits BEGIN and every
      // nested one a SAVEPOINT, against the connection already in context. Both
      // arms of the port are therefore the same call.
      const withTransaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        Database.mapSqlError(sql.withTransaction(effect)).pipe(
          Effect.mapError(translateDatabaseFailure),
        );

      return TransactionDriver.of({
        withTransaction,
        withSavepoint: withTransaction,
        isActive: Effect.serviceOption(sql.transactionService).pipe(Effect.map(Option.isSome)),
      });
    }),
  );
