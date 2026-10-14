import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { Spec } from "@/globals/application/ddd/specification";
import { type CompleteTodoPayload } from "@/modules/todos/commands/complete-todo.command";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification";

export const completeTodoHandler = Effect.fn("completeTodoHandler")(function* (
  cmd: CompleteTodoPayload,
) {
  const repo = yield* TodosRepository;

  const found = yield* repo.findOne(
    Spec.and(
      TodoSpecifications.withId(cmd.todoId),
      TodoSpecifications.forOrganization(cmd.organizationId),
    ),
  );

  if (Option.isNone(found)) {
    return yield* new TodoNotFound({ todoId: cmd.todoId });
  }

  const existing = found.value;

  const now = yield* DateTime.now;
  const completed = TodoRootOps.complete(existing, now);
  yield* repo.updateOne(completed);

  return completed;
});
