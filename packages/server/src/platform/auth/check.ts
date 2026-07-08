import * as Effect from "effect/Effect";

// A Check is a per-(caller, resource) boolean predicate expressed as an
// Effect so it can reach repositories, the bus, etc. via the Effect
// environment. Returning boolean (not void+Forbidden) lets policies
// compose with the OR / AND combinators below before the final lift to
// Forbidden happens at the `authz.ts` boundary.
//
// Resource is parameterised. The Phase-1.5 typed registry pins the
// concrete `Caller` to `CurrentUser["Service"]` and the `Resource` to the
// per-action type from the declaration-merged `PolicyMap`.

export type Check<Caller, Resource, E = never, R = never> = (
  caller: Caller,
  resource: Resource,
) => Effect.Effect<boolean, E, R>;

// OR semantics. Short-circuits on the first true. With zero checks,
// returns false — denying by default is the safer floor.
export const any =
  <Caller, Resource, E = never, R = never>(
    ...checks: ReadonlyArray<Check<Caller, Resource, E, R>>
  ): Check<Caller, Resource, E, R> =>
  (caller, resource) =>
    Effect.gen(function* () {
      for (const check of checks) {
        const result = yield* check(caller, resource);
        if (result) return true;
      }
      return false;
    });

// AND semantics. Short-circuits on the first false. With zero checks,
// returns true (vacuously) — same semantics as `Array.every`.
export const all =
  <Caller, Resource, E = never, R = never>(
    ...checks: ReadonlyArray<Check<Caller, Resource, E, R>>
  ): Check<Caller, Resource, E, R> =>
  (caller, resource) =>
    Effect.gen(function* () {
      for (const check of checks) {
        const result = yield* check(caller, resource);
        if (!result) return false;
      }
      return true;
    });
