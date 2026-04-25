import { QueryData, useEffectMutation, useEffectQuery } from "@/lib/tanstack-query";
import { SseContract, type TodosContract } from "@org/domain/api/Contracts";
import { type TodoId } from "@org/domain/EntityIds";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { ApiClient } from "../common/api-client";

export namespace TodosQueries {
  const todosKey = QueryData.makeQueryKey("todos");
  const todosHelpers = QueryData.makeHelpers<Array<TodosContract.Todo>>(todosKey);

  const pendingOptimisticIds = Ref.unsafeMake(new Set<string>());

  export const useTodosQuery = () => {
    return useEffectQuery({
      queryKey: todosKey(),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      queryFn: () => ApiClient.use(({ client }) => client.todos.get()),
    });
  };

  export const useCreateTodoMutation = () => {
    return useEffectMutation({
      mutationKey: ["TodosQueries.createTodo"],
      mutationFn: Effect.fnUntraced(function* (
        todo: Omit<TodosContract.CreateTodoPayload, "optimisticId">,
      ) {
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
      }, Effect.scoped),
      toastifySuccess: () => "Todo created!",
    });
  };

  export const useUpdateTodoMutation = () => {
    return useEffectMutation({
      mutationKey: ["TodosQueries.updateTodo"],
      mutationFn: (todo: TodosContract.Todo) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        ApiClient.use(({ client }) => client.todos.update({ payload: todo })).pipe(
          Effect.tap((updatedTodo) =>
            todosHelpers.setData((draft) => {
              const index = draft.findIndex((t) => t.id === updatedTodo.id);
              if (index !== -1) {
                draft[index] = updatedTodo;
              }
            }),
          ),
        ),
      toastifySuccess: () => "Todo updated!",
    });
  };

  export const useDeleteTodoMutation = () => {
    return useEffectMutation({
      mutationKey: ["TodosQueries.deleteTodo"],
      mutationFn: (id: TodoId) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        ApiClient.use(({ client }) => client.todos.delete({ payload: id })).pipe(
          Effect.tap(() =>
            todosHelpers.setData((draft) => {
              const index = draft.findIndex((t) => t.id === id);
              if (index !== -1) {
                draft.splice(index, 1);
              }
            }),
          ),
        ),
      toastifySuccess: () => "Todo deleted!",
      toastifyErrors: {
        TodoNotFoundError: (error) => error.message,
      },
    });
  };

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
