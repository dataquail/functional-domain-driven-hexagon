import { ApiClient } from "@/services/common/api-client";
import { QueryClient } from "@/services/common/query-client";
import { WorkerClient } from "@/services/worker/worker-client";
import { FilterError } from "@/services/worker/worker-rpc";
import { RecordedToasts, RecordingToast } from "@/test/recording-toast";
import { describe, it } from "@effect/vitest";
import { type TodosContract } from "@org/contracts/api/Contracts";
import { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { deepStrictEqual } from "node:assert";
import { make } from "./index.view-model";

const FakeApiClient = (todos: ReadonlyArray<TodosContract.Todo>): Layer.Layer<ApiClient> =>
  Layer.succeed(
    ApiClient,
    ApiClient.of({
      client: { todos: { get: () => Effect.succeed(todos) } },
      unsafeClient: {},
    } as unknown as ApiClient),
  );

const FakeWorkerClient = (overrides?: {
  filterData?: (payload: {
    data: ReadonlyArray<number>;
    threshold: number;
  }) => Effect.Effect<ReadonlyArray<number>, FilterError>;
  calculatePrimes?: (payload: { upperBound: number }) => Effect.Effect<number>;
}): Layer.Layer<WorkerClient> =>
  Layer.succeed(
    WorkerClient,
    WorkerClient.of({
      client: {
        filterData:
          overrides?.filterData ??
          ((payload) => Effect.succeed(payload.data.filter((n) => n > payload.threshold))),
        calculatePrimes:
          overrides?.calculatePrimes ?? ((payload) => Effect.succeed(payload.upperBound)),
      },
    } as unknown as WorkerClient),
  );

const TestQueryClient = QueryClient.make(new TanstackQueryClient());

const makeTestLayer = (opts?: { worker?: Parameters<typeof FakeWorkerClient>[0] }) =>
  Layer.mergeAll(
    FakeApiClient([]),
    TestQueryClient,
    RecordingToast,
    FakeWorkerClient(opts?.worker),
  );

describe("IndexViewModel", () => {
  it.effect("filterLargeData emits a success toast and resets filterPending", () =>
    Effect.gen(function* () {
      const vm = yield* make;

      yield* vm.actions.filterLargeData;

      const recorded = yield* RecordedToasts;
      const calls = yield* recorded.all;
      deepStrictEqual(calls.length, 1);
      deepStrictEqual(calls[0]?.kind, "success");

      const finalState = yield* SubscriptionRef.get(vm.state);
      deepStrictEqual(finalState.filterPending, false);
    }).pipe(Effect.scoped, Effect.provide(makeTestLayer())),
  );

  it.effect("filterLargeData failure emits an error toast and resets filterPending", () =>
    Effect.gen(function* () {
      const vm = yield* make;

      yield* vm.actions.filterLargeData;

      const recorded = yield* RecordedToasts;
      const calls = yield* recorded.all;
      deepStrictEqual(calls.length, 1);
      deepStrictEqual(calls[0]?.kind, "error");

      const finalState = yield* SubscriptionRef.get(vm.state);
      deepStrictEqual(finalState.filterPending, false);
    }).pipe(
      Effect.scoped,
      Effect.provide(
        makeTestLayer({
          worker: { filterData: () => Effect.fail(new FilterError({ message: "boom" })) },
        }),
      ),
    ),
  );

  it.effect("calculatePrimes emits a success toast and resets primesPending", () =>
    Effect.gen(function* () {
      const vm = yield* make;

      yield* vm.actions.calculatePrimes;

      const recorded = yield* RecordedToasts;
      const calls = yield* recorded.all;
      deepStrictEqual(calls.length, 1);
      deepStrictEqual(calls[0]?.kind, "success");

      const finalState = yield* SubscriptionRef.get(vm.state);
      deepStrictEqual(finalState.primesPending, false);
    }).pipe(Effect.scoped, Effect.provide(makeTestLayer())),
  );
});
