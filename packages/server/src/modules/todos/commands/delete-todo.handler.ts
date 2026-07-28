import * as Effect from "effect/Effect";

import { type DeleteTodoPayload } from "@/modules/todos/commands/delete-todo.command.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";

export const deleteTodo = Effect.fn("deleteTodo")(function* (cmd: DeleteTodoPayload) {
  const repo = yield* TodosRepository;
  yield* repo.deleteOne(cmd.organizationId, cmd.todoId);
});
