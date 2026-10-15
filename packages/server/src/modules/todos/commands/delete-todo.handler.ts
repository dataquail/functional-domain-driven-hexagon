import * as Effect from "effect/Effect";

import { type DeleteTodoPayload } from "@/modules/todos/commands/delete-todo.command";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository";

export const deleteTodoHandler = Effect.fn("deleteTodoHandler")(function* (cmd: DeleteTodoPayload) {
  const repo = yield* TodosRepository;
  yield* repo.deleteOne(cmd.organizationId, cmd.todoId);
});
