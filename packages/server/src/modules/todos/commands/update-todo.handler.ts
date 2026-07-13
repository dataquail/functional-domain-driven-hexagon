import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type UpdateTodoCommand } from "@/modules/todos/commands/update-todo.command.js";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";

export const updateTodo = Effect.fn("updateTodo")(function* (cmd: UpdateTodoCommand) {
  const repo = yield* TodosRepository;
  const existing = yield* repo.findOne(
    Spec.and(
      TodoSpecifications.withId(cmd.todoId),
      TodoSpecifications.forOrganization(cmd.organizationId),
    ),
  );
  if (existing === null) {
    return yield* new TodoNotFound({ todoId: cmd.todoId });
  }
  const now = yield* DateTime.now;
  const updated = TodoRootOps.update(existing, {
    title: cmd.title,
    completed: cmd.completed,
    now,
  });
  yield* repo.updateOne(updated);
  return updated;
});
