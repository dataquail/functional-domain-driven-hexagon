import * as Effect from "effect/Effect";

/**
 * Pipeable helper for the "decode-or-fail" pattern that arises after
 * `client.maybeOne(...)` (which yields `Row | null`). Narrows null and
 * raises a typed error in one step.
 *
 * Why: a ternary inside `Effect.flatMap` infers as a union of two distinct
 * `Effect<...>` instantiations and collapses the pipeline to
 * `Effect<unknown, unknown, unknown>`. `filterOrFail` has a single declared
 * signature, so the union is merged at the combinator boundary.
 */
export const orFail =
  <E>(onNull: () => E) =>
  <A, E0, R>(self: Effect.Effect<A | null, E0, R>): Effect.Effect<NonNullable<A>, E0 | E, R> =>
    Effect.filterOrFail(self, (a): a is NonNullable<A> => a !== null, onNull);
