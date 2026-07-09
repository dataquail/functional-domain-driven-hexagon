import * as Effect from "effect/Effect";

import { type DeleteTodoCommand } from "@/modules/todos/commands/delete-todo.command.js";
import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";

export const deleteTodo = Effect.fn("deleteTodo")(function* (cmd: DeleteTodoCommand) {
  const repo = yield* TodosRepository;
  yield* repo.deleteOne(cmd.organizationId, cmd.todoId);
});
