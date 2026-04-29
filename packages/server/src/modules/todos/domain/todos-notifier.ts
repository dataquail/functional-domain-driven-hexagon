import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import { type TodoId } from "./todo-id.js";
import { type Todo } from "./todo.js";
import { type UserId } from "./user-id.js";

// Module-owned facade over the platform SSE manager. Commands talk to this
// port so the side effect lives in the use case; the live impl encodes the
// typed event via TodosContract.SseEvents and delegates to SseManager.
export type TodosNotifierShape = {
  readonly notifyUpserted: (input: {
    readonly userId: UserId;
    readonly todo: Todo;
    readonly optimisticId?: string;
  }) => Effect.Effect<void>;
  readonly notifyDeleted: (input: {
    readonly userId: UserId;
    readonly todoId: TodoId;
  }) => Effect.Effect<void>;
};

export class TodosNotifier extends Context.Tag("TodosNotifier")<
  TodosNotifier,
  TodosNotifierShape
>() {}
