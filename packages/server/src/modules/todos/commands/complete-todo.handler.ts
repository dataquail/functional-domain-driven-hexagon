import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type CompleteTodoCommand } from "@/modules/todos/commands/complete-todo.command.js";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";

export const completeTodo = Effect.fn("completeTodo")(function* (cmd: CompleteTodoCommand) {
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
  const completed = TodoRootOps.complete(existing, now);
  yield* repo.updateOne(completed);
  return completed;
});
