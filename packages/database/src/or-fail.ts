import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

// Pipeable "decode-or-fail" after `Database.maybeRow`: unwraps the row, or
// raises the caller's typed error when the statement matched none.
export const orFail =
  <E>(onNone: () => E) =>
  <A, E0, R>(self: Effect.Effect<Option.Option<A>, E0, R>): Effect.Effect<A, E0 | E, R> =>
    Effect.flatMap(
      self,
      Option.match({ onNone: () => Effect.fail(onNone()), onSome: Effect.succeed }),
    );
