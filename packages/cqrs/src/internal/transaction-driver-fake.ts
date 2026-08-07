import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import type { PersistenceUnavailable } from "../persistence-unavailable.js";
import {
  TransactionDriver,
  type TransactionDriverShape,
  type TransactionFailed,
} from "../transaction-driver.js";

/**
 * The in-memory atomicity primitive the package's own tests run on. It opens no
 * real scope but reports one active for the duration of the effect it wraps,
 * which is the whole of what the unit of work reads back from a driver.
 *
 * It lives in `internal/` rather than beside its callers because the published
 * deep-specifier surface is generated from the top level of `src/` — a file
 * there would ship as public API, and a test double is not that.
 */
export type Scope = "transaction" | "savepoint";

/**
 * Records which scope the unit of work asked for.
 *
 * The depth is a counter rather than a flag, so a scope closing does not report
 * the enclosing one closed too — that is what `run` reads to decide whether to
 * nest.
 */
export const makeRecordingDriver: Effect.Effect<{
  readonly driver: TransactionDriverShape;
  readonly scopes: Effect.Effect<ReadonlyArray<Scope>>;
}> = Effect.gen(function* () {
  const scopes = yield* Ref.make<ReadonlyArray<Scope>>([]);
  const depth = yield* Ref.make(0);

  const enter =
    (scope: Scope) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Ref.update(scopes, (prev) => [...prev, scope]).pipe(
        Effect.andThen(Ref.update(depth, (open) => open + 1)),
        Effect.andThen(effect),
        Effect.ensuring(Ref.update(depth, (open) => open - 1)),
      );

  return {
    driver: TransactionDriver.of({
      withTransaction: enter("transaction"),
      withSavepoint: enter("savepoint"),
      isActive: Effect.map(Ref.get(depth), (open) => open > 0),
    }),
    scopes: Ref.get(scopes),
  };
});

/** The same driver as a Layer, for tests that never inspect which scope was opened. */
export const RecordingTransactionDriver: Layer.Layer<TransactionDriver> = Layer.effect(
  TransactionDriver,
  Effect.map(makeRecordingDriver, ({ driver }) => driver),
);

/** A driver whose scope always fails the way a host adapter would report it. */
export const driverFailingWith = (
  error: TransactionFailed | PersistenceUnavailable,
): Layer.Layer<TransactionDriver> =>
  Layer.succeed(
    TransactionDriver,
    TransactionDriver.of({
      withTransaction: () => Effect.fail(error),
      withSavepoint: () => Effect.fail(error),
      isActive: Effect.succeed(false),
    }),
  );
