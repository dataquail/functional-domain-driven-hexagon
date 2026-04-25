import * as Effect from "effect/Effect";
import { dual } from "effect/Function";

/**
 * Runs a prerequisite effect before the main effect.
 * The result of the prerequisite effect is discarded, and the result of the main effect is returned.
 * This is equivalent to `Effect.zipRight(prerequisite, self)`.
 */
export const pre: {
  <B, E2, R2>(
    prerequisite: Effect.Effect<B, E2, R2>,
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | E2, R | R2>;
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    prerequisite: Effect.Effect<B, E2, R2>,
  ): Effect.Effect<A, E | E2, R | R2>;
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Effect.Effect<A, E, R>,
    prerequisite: Effect.Effect<B, E2, R2>,
  ): Effect.Effect<A, E | E2, R | R2> => Effect.zipRight(prerequisite, self),
);
