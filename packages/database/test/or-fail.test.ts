import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { orFail } from "../src/or-fail.js";

class NotFound extends Schema.TaggedError<NotFound, { readonly brand: "NotFound" }>()(
  "NotFound",
  {},
) {}

class StoreDown extends Schema.TaggedError<StoreDown, { readonly brand: "StoreDown" }>()(
  "StoreDown",
  {},
) {}

describe("orFail", () => {
  it.effect("unwraps the value when the upstream effect succeeds with some", () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeedSome("hello").pipe(orFail(() => new NotFound()));

      expect(result).toBe("hello");
    }),
  );

  it.effect("fails with the provided error when the upstream effect succeeds with none", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Effect.succeedNone.pipe(orFail(() => new NotFound())));

      assertInstanceOf(error, NotFound);
    }),
  );

  it.effect("propagates upstream failures unchanged", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Effect.fail(new StoreDown()).pipe(
          Effect.as(Option.none<string>()),
          orFail(() => new NotFound()),
        ),
      );

      assertInstanceOf(error, StoreDown);
    }),
  );
});
