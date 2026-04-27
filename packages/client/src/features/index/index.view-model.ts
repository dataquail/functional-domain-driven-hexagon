import { ApiClient } from "@/services/common/api-client";
import { QueryClient } from "@/services/common/query-client";
import { Toast } from "@/services/common/toast";
import { TodosQueries } from "@/services/data-access/todos-queries";
import { WorkerClient } from "@/services/worker/worker-client";
import { type TodosContract } from "@org/contracts/api/Contracts";
import { QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import * as Array from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Runtime from "effect/Runtime";
import type * as Scope from "effect/Scope";
import * as SubscriptionRef from "effect/SubscriptionRef";

export type TodosViewState =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | { readonly kind: "ready"; readonly todos: ReadonlyArray<TodosContract.Todo> }
  | { readonly kind: "error"; readonly message: string };

export type IndexViewState = {
  readonly todos: TodosViewState;
  readonly filterPending: boolean;
  readonly primesPending: boolean;
};

export const initialIndexViewState: IndexViewState = {
  todos: { kind: "loading" },
  filterPending: false,
  primesPending: false,
};

export type IndexViewModel = {
  readonly state: SubscriptionRef.SubscriptionRef<IndexViewState>;
  readonly filterLargeData: Effect.Effect<void>;
  readonly calculatePrimes: Effect.Effect<void>;
};

const FILTER_DATA_SIZE = 1_000_000;
const FILTER_THRESHOLD = 99_990;
const PRIME_UPPER_BOUND = 10_000_000;

export const deriveTodosViewState = (
  result: Pick<QueryObserverResult<ReadonlyArray<TodosContract.Todo>>, "data" | "status">,
): TodosViewState => {
  if (result.status === "error") return { kind: "error", message: "Failed to load todos" };
  if (result.status === "pending" || result.data === undefined) return { kind: "loading" };
  if (result.data.length === 0) return { kind: "empty" };
  return { kind: "ready", todos: result.data };
};

export const make: Effect.Effect<
  IndexViewModel,
  never,
  ApiClient | QueryClient | Toast | WorkerClient | Scope.Scope
> = Effect.gen(function* () {
  const apiClient = yield* ApiClient;
  const queryClient = yield* QueryClient;
  const toast = yield* Toast;
  const workerClient = yield* WorkerClient;
  const runtime = yield* Effect.runtime<never>();
  const runFork = Runtime.runFork(runtime);

  const state = yield* SubscriptionRef.make(initialIndexViewState);

  const observer = new QueryObserver<
    ReadonlyArray<TodosContract.Todo>,
    Error,
    ReadonlyArray<TodosContract.Todo>,
    ReadonlyArray<TodosContract.Todo>,
    readonly ["todos"]
  >(queryClient, {
    queryKey: ["todos"] as const,
    queryFn: () =>
      Effect.runPromise(TodosQueries.getTodos.pipe(Effect.provideService(ApiClient, apiClient))),
  });

  const writeTodosState = (result: QueryObserverResult<ReadonlyArray<TodosContract.Todo>>) =>
    SubscriptionRef.update(state, (s) => ({ ...s, todos: deriveTodosViewState(result) }));

  yield* writeTodosState(observer.getCurrentResult());
  const unsubscribe = observer.subscribe((result) => {
    runFork(writeTodosState(result));
  });
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      unsubscribe();
      observer.destroy();
    }),
  );

  const filterLargeData = Effect.gen(function* () {
    yield* SubscriptionRef.update(state, (s) => ({ ...s, filterPending: true }));
    const data = Array.makeBy(FILTER_DATA_SIZE, (i) => i);
    const [duration, items] = yield* Effect.timed(
      workerClient.client.filterData({ data, threshold: FILTER_THRESHOLD }),
    );
    yield* toast.success(`Filtered ${items.length} items in ${Duration.format(duration)}`);
  }).pipe(
    Effect.catchTag("FilterError", () => toast.error("Error filtering data")),
    Effect.ensuring(SubscriptionRef.update(state, (s) => ({ ...s, filterPending: false }))),
    Effect.withSpan("IndexViewModel.filterLargeData"),
  );

  const calculatePrimes = Effect.gen(function* () {
    yield* SubscriptionRef.update(state, (s) => ({ ...s, primesPending: true }));
    yield* Effect.logInfo(`Requesting prime calculation up to ${PRIME_UPPER_BOUND}`);
    const [duration, primeCount] = yield* Effect.timed(
      workerClient.client.calculatePrimes({ upperBound: PRIME_UPPER_BOUND }),
    );
    yield* toast.success(`Found ${primeCount} primes in ${Duration.format(duration)}`);
  }).pipe(
    Effect.ensuring(SubscriptionRef.update(state, (s) => ({ ...s, primesPending: false }))),
    Effect.withSpan("IndexViewModel.calculatePrimes"),
  );

  return { state, filterLargeData, calculatePrimes };
});
