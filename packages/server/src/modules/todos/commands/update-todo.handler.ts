import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type UpdateTodoCommand } from "@/modules/todos/commands/update-todo.command.js";
import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root-ops.js";

export const updateTodo = Effect.fn("updateTodo")(function* (cmd: UpdateTodoCommand) {
  const repo = yield* TodosRepository;
  const existing = yield* repo.findOneById(cmd.organizationId, cmd.todoId);
  const now = yield* DateTime.now;
  const updated = TodoRootOps.update(existing, {
    title: cmd.title,
    completed: cmd.completed,
    now,
  });
  yield* repo.updateOne(updated);
  return updated;
});
