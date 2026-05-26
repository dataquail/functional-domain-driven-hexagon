import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { all, any, type Check } from "./check.js";

// Synthetic user/resource shapes — the combinators are agnostic to what
// flows through them; the typed wiring lives in `policy-registry.ts` and
// `authz.ts`. Tests here cover OR/AND semantics + short-circuit.

type Caller = { readonly id: string; readonly isSuperAdmin: boolean };
type Thing = { readonly ownerId: string };

const constant =
  (result: boolean): Check<Caller, Thing> =>
  () =>
    Effect.succeed(result);

const explodesIfCalled: Check<Caller, Thing> = () =>
  Effect.die("check should have been short-circuited");

describe("Check.any", () => {
  it.effect("returns true when the first check passes (short-circuits)", () =>
    Effect.gen(function* () {
      const result = yield* any<Caller, Thing>(constant(true), explodesIfCalled)(
        { id: "u1", isSuperAdmin: false },
        { ownerId: "u1" },
      );
      deepStrictEqual(result, true);
    }),
  );

  it.effect("returns true when a later check passes", () =>
    Effect.gen(function* () {
      const result = yield* any<Caller, Thing>(constant(false), constant(true))(
        { id: "u1", isSuperAdmin: false },
        { ownerId: "u1" },
      );
      deepStrictEqual(result, true);
    }),
  );

  it.effect("returns false when every check returns false", () =>
    Effect.gen(function* () {
      const result = yield* any<Caller, Thing>(constant(false), constant(false))(
        { id: "u1", isSuperAdmin: false },
        { ownerId: "u1" },
      );
      deepStrictEqual(result, false);
    }),
  );
});

describe("Check.all", () => {
  it.effect("returns true only when every check passes", () =>
    Effect.gen(function* () {
      const result = yield* all<Caller, Thing>(constant(true), constant(true))(
        { id: "u1", isSuperAdmin: false },
        { ownerId: "u1" },
      );
      deepStrictEqual(result, true);
    }),
  );

  it.effect("returns false as soon as a check returns false (short-circuits)", () =>
    Effect.gen(function* () {
      const result = yield* all<Caller, Thing>(constant(false), explodesIfCalled)(
        { id: "u1", isSuperAdmin: false },
        { ownerId: "u1" },
      );
      deepStrictEqual(result, false);
    }),
  );
});
