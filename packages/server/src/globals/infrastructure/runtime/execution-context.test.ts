import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import {
  ExecutionContext,
  makeWorkerExecutionContext,
  waitUntil,
} from "@/globals/infrastructure/runtime/execution-context.js";

describe("waitUntil", () => {
  it.effect("runs the work on a detached fiber outside a Worker", () =>
    Effect.gen(function* () {
      const done = yield* Deferred.make<string>();

      yield* waitUntil(Deferred.succeed(done, "touched"));

      deepStrictEqual(yield* Deferred.await(done), "touched");
    }),
  );

  it.effect("hands a Worker the work as a promise it can wait on", () =>
    Effect.gen(function* () {
      const registered: Array<Promise<unknown>> = [];
      const touched = yield* Ref.make(false);

      yield* waitUntil(Ref.set(touched, true)).pipe(
        Effect.provideService(
          ExecutionContext,
          makeWorkerExecutionContext((promise) => registered.push(promise)),
        ),
      );
      yield* Effect.promise(() => Promise.all(registered));

      deepStrictEqual(registered.length, 1);
      deepStrictEqual(yield* Ref.get(touched), true);
    }),
  );
});
