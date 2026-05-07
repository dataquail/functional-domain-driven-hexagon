import { QueryData, useEffectMutation, useEffectQuery } from "@/lib/tanstack-query";
import { type TodosContract } from "@org/contracts/api/Contracts";
import { type TodoId } from "@org/contracts/EntityIds";
import { QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { ApiClient } from "../common/api-client";
import { QueryClient } from "../common/query-client";

/**
 * Normalized read-side query state. `observeTodos` and any future Stream-shaped
 * data-access exports map TanStack's QueryObserverResult into this shape so
 * consumers (ViewModels) don't depend on @tanstack/*. See ADR-0014.
 */
export type QueryState<T> =
  | { readonly status: "pending"; readonly data: undefined }
  | { readonly status: "success"; readonly data: T }
  | {
      readonly status: "error";
      readonly data: T | undefined;
      readonly error: Error;
    };

export namespace TodosQueries {
  const todosKey = QueryData.makeQueryKey("todos");
  const todosHelpers = QueryData.makeHelpers<Array<TodosContract.Todo>>(todosKey);

  // ── List ─────────────────────────────────────────────────────────────────

  export const getTodos = Effect.flatMap(ApiClient, ({ client }) => client.todos.get());

  export const useTodosQuery = () =>
    useEffectQuery({
      queryKey: todosKey(),
      queryFn: () => getTodos,
    });

  const toQueryState = (
    result: QueryObserverResult<ReadonlyArray<TodosContract.Todo>>,
  ): QueryState<ReadonlyArray<TodosContract.Todo>> => {
    if (result.status === "error") {
      return { status: "error", data: result.data, error: result.error };
    }
    if (result.status === "success") {
      return { status: "success", data: result.data };
    }
    return { status: "pending", data: undefined };
  };

  export const observeTodos: Stream.Stream<
    QueryState<ReadonlyArray<TodosContract.Todo>>,
    never,
    ApiClient | QueryClient
  > = Stream.unwrap(
    Effect.gen(function* () {
      const apiClient = yield* ApiClient;
      const queryClient = yield* QueryClient;

      const observer = new QueryObserver<
        ReadonlyArray<TodosContract.Todo>,
        Error,
        ReadonlyArray<TodosContract.Todo>,
        ReadonlyArray<TodosContract.Todo>,
        readonly ["todos"]
      >(queryClient, {
        queryKey: todosKey(),
        queryFn: () =>
          Effect.runPromise(getTodos.pipe(Effect.provideService(ApiClient, apiClient))),
      });

      return Stream.async<QueryState<ReadonlyArray<TodosContract.Todo>>>((emit) => {
        void emit.single(toQueryState(observer.getCurrentResult()));
        const unsubscribe = observer.subscribe((result) => {
          void emit.single(toQueryState(result));
        });
        return Effect.sync(() => {
          unsubscribe();
          observer.destroy();
        });
      });
    }),
  );

  // ── Create ───────────────────────────────────────────────────────────────

  export const createTodo = (todo: TodosContract.CreateTodoPayload) =>
    Effect.flatMap(ApiClient, ({ client }) => client.todos.create({ payload: todo })).pipe(
      Effect.tap(() => todosHelpers.invalidateAllQueries()),
    );

  export const useCreateTodoMutation = () =>
    useEffectMutation({
      mutationKey: ["TodosQueries.createTodo"],
      mutationFn: createTodo,
      toastifySuccess: () => "Todo created!",
    });

  // ── Update ───────────────────────────────────────────────────────────────

  export const updateTodo = (todo: TodosContract.Todo) =>
    Effect.flatMap(ApiClient, ({ client }) => client.todos.update({ payload: todo })).pipe(
      Effect.tap(() => todosHelpers.invalidateAllQueries()),
    );

  export const useUpdateTodoMutation = () =>
    useEffectMutation({
      mutationKey: ["TodosQueries.updateTodo"],
      mutationFn: updateTodo,
      toastifySuccess: () => "Todo updated!",
    });

  // ── Delete ───────────────────────────────────────────────────────────────

  export const deleteTodo = (id: TodoId) =>
    Effect.flatMap(ApiClient, ({ client }) => client.todos.delete({ payload: id })).pipe(
      Effect.tap(() => todosHelpers.invalidateAllQueries()),
    );

  export const useDeleteTodoMutation = () =>
    useEffectMutation({
      mutationKey: ["TodosQueries.deleteTodo"],
      mutationFn: deleteTodo,
      toastifySuccess: () => "Todo deleted!",
      toastifyErrors: {
        TodoNotFoundError: (error) => error.message,
      },
    });
}
