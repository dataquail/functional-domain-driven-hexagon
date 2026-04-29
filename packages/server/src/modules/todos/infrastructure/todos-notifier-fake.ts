import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { type TodoId } from "../domain/todo-id.js";
import { type Todo } from "../domain/todo.js";
import { TodosNotifier } from "../domain/todos-notifier.js";
import { type UserId } from "../domain/user-id.js";

// Test double for `TodosNotifier`: records every call and exposes the log
// for assertions. Use-case unit tests verify that the right notification
// fires after the right persistence step without wiring up SseManager.

export type RecordedNotification =
  | {
      readonly _tag: "Upserted";
      readonly userId: UserId;
      readonly todo: Todo;
      readonly optimisticId?: string;
    }
  | { readonly _tag: "Deleted"; readonly userId: UserId; readonly todoId: TodoId };

export class RecordedNotifications extends Context.Tag("RecordedNotifications")<
  RecordedNotifications,
  {
    readonly all: Effect.Effect<ReadonlyArray<RecordedNotification>>;
  }
>() {}

export const TodosNotifierFake: Layer.Layer<TodosNotifier | RecordedNotifications> =
  Layer.effectContext(
    Effect.gen(function* () {
      const log = yield* Ref.make<ReadonlyArray<RecordedNotification>>([]);

      return Context.empty().pipe(
        Context.add(
          TodosNotifier,
          TodosNotifier.of({
            notifyUpserted: ({ optimisticId, todo, userId }) =>
              Ref.update(log, (prev) => [
                ...prev,
                {
                  _tag: "Upserted" as const,
                  todo,
                  userId,
                  ...(optimisticId !== undefined && { optimisticId }),
                },
              ]),
            notifyDeleted: ({ todoId, userId }) =>
              Ref.update(log, (prev) => [...prev, { _tag: "Deleted" as const, todoId, userId }]),
          }),
        ),
        Context.add(RecordedNotifications, { all: Ref.get(log) }),
      );
    }),
  );
