import { SseManager } from "@/platform/sse-manager.js";
import { SseContract, TodosContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { TodosNotifier } from "../domain/todos-notifier.js";

const encodeEvent = Schema.encode(Schema.parseJson(SseContract.Events));

export const TodosNotifierLive = Layer.effect(
  TodosNotifier,
  Effect.gen(function* () {
    const sseManager = yield* SseManager;

    return TodosNotifier.of({
      notifyUpserted: ({ optimisticId, todo, userId }) =>
        Effect.gen(function* () {
          const payload = yield* encodeEvent(
            new TodosContract.SseEvents.UpsertedTodo({
              todo: new TodosContract.Todo({
                id: todo.id,
                title: todo.title,
                completed: todo.completed,
              }),
              optimisticId,
            }),
          ).pipe(Effect.orDie);
          yield* sseManager.notifyUser({ payload, userId });
        }),

      notifyDeleted: ({ todoId, userId }) =>
        Effect.gen(function* () {
          const payload = yield* encodeEvent(
            new TodosContract.SseEvents.DeletedTodo({ id: todoId }),
          ).pipe(Effect.orDie);
          yield* sseManager.notifyUser({ payload, userId });
        }),
    });
  }),
);
