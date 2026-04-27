import { QueryData, useEffectMutation, useEffectQuery } from "@/lib/tanstack-query";
import { SseContract, type TodosContract } from "@org/contracts/api/Contracts";
import { type TodoId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { ApiClient } from "../common/api-client";

export namespace TodosQueries {
  const todosKey = QueryData.makeQueryKey("todos");
  const todosHelpers = QueryData.makeHelpers<Array<TodosContract.Todo>>(todosKey);

  const pendingOptimisticIds = Ref.unsafeMake(new Set<string>());

  // ── List ─────────────────────────────────────────────────────────────────

  export const getTodos = Effect.flatMap(ApiClient, ({ client }) => client.todos.get());

  export const useTodosQuery = () =>
    useEffectQuery({
      queryKey: todosKey(),
      queryFn: () => getTodos,
    });

  // ── Create ───────────────────────────────────────────────────────────────

  export const createTodo = (todo: Omit<TodosContract.CreateTodoPayload, "optimisticId">) =>
    Effect.gen(function* () {
      const { client } = yield* ApiClient;

      const optimisticId = crypto.randomUUID();
      yield* Ref.update(pendingOptimisticIds, (set) => set.add(optimisticId));
      yield* Effect.addFinalizer(() =>
        Ref.update(pendingOptimisticIds, (set) => {
          set.delete(optimisticId);
          return set;
        }),
      );

      return yield* client.todos.create({ payload: { ...todo, optimisticId } }).pipe(
        Effect.tap((createdTodo) =>
          todosHelpers.setData((draft) => {
            if (!draft.some((t) => t.id === createdTodo.id)) {
              draft.unshift(createdTodo);
            }
          }),
        ),
      );
    }).pipe(Effect.scoped);

  export const useCreateTodoMutation = () =>
    useEffectMutation({
      mutationKey: ["TodosQueries.createTodo"],
      mutationFn: createTodo,
      toastifySuccess: () => "Todo created!",
    });

  // ── Update ───────────────────────────────────────────────────────────────

  export const updateTodo = (todo: TodosContract.Todo) =>
    Effect.flatMap(ApiClient, ({ client }) => client.todos.update({ payload: todo })).pipe(
      Effect.tap((updatedTodo) =>
        todosHelpers.setData((draft) => {
          const index = draft.findIndex((t) => t.id === updatedTodo.id);
          if (index !== -1) {
            draft[index] = updatedTodo;
          }
        }),
      ),
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
      Effect.tap(() =>
        todosHelpers.setData((draft) => {
          const index = draft.findIndex((t) => t.id === id);
          if (index !== -1) {
            draft.splice(index, 1);
          }
        }),
      ),
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

  // ── SSE event integration ────────────────────────────────────────────────

  export const stream = <E, R>(self: Stream.Stream<SseContract.Events, E, R>) =>
    self.pipe(
      Stream.filter(SseContract.Todos.is),
      Stream.tap((event) =>
        Match.value(event).pipe(
          Match.tag("UpsertedTodo", (upsertedEvent) =>
            Effect.gen(function* () {
              const pendingIds = yield* Ref.get(pendingOptimisticIds);
              if (
                upsertedEvent.optimisticId !== undefined &&
                pendingIds.has(upsertedEvent.optimisticId)
              ) {
                return;
              }

              yield* todosHelpers.setData((draft) => {
                const index = draft.findIndex((t) => t.id === upsertedEvent.todo.id);
                if (index !== -1) {
                  draft[index] = upsertedEvent.todo;
                } else {
                  draft.unshift(upsertedEvent.todo);
                }
              });
            }),
          ),
          Match.tag("DeletedTodo", (deletedEvent) =>
            todosHelpers.setData((draft) => {
              const index = draft.findIndex((t) => t.id === deletedEvent.id);
              if (index !== -1) {
                draft.splice(index, 1);
              }
            }),
          ),
          Match.exhaustive,
        ),
      ),
    );
}
