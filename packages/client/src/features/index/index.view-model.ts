import { type ViewModel } from "@/lib/view-model";
import { type ApiClient } from "@/services/common/api-client";
import { type QueryClient } from "@/services/common/query-client";
import { Toast } from "@/services/common/toast";
import { type QueryState, TodosQueries } from "@/services/data-access/todos-queries";
import { WorkerClient } from "@/services/worker/worker-client";
import { type TodosContract } from "@org/contracts/api/Contracts";
import * as Array from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
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

type IndexActions = {
  readonly filterLargeData: Effect.Effect<void>;
  readonly calculatePrimes: Effect.Effect<void>;
};

export type IndexViewModel = ViewModel<IndexViewState, IndexActions>;

const FILTER_DATA_SIZE = 1_000_000;
const FILTER_THRESHOLD = 99_990;
const PRIME_UPPER_BOUND = 10_000_000;

export const deriveTodosViewState = (
  result: QueryState<ReadonlyArray<TodosContract.Todo>>,
): TodosViewState => {
  if (result.status === "error") return { kind: "error", message: "Failed to load todos" };
  if (result.status === "pending") return { kind: "loading" };
  if (result.data.length === 0) return { kind: "empty" };
  return { kind: "ready", todos: result.data };
};

export const make: Effect.Effect<
  IndexViewModel,
  never,
  ApiClient | QueryClient | Toast | WorkerClient | Scope.Scope
> = Effect.gen(function* () {
  const toast = yield* Toast;
  const workerClient = yield* WorkerClient;
  const state = yield* SubscriptionRef.make(initialIndexViewState);

  yield* Effect.forkScoped(
    TodosQueries.observeTodos.pipe(
      Stream.tap((result) =>
        SubscriptionRef.update(state, (s) => ({ ...s, todos: deriveTodosViewState(result) })),
      ),
      Stream.runDrain,
    ),
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

  return {
    state,
    actions: { filterLargeData, calculatePrimes },
  };
});
