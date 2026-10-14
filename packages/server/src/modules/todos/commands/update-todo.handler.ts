import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { Spec } from "@/globals/application/ddd/specification.ts";
import { type UpdateTodoPayload } from "@/modules/todos/commands/update-todo.command.ts";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.ts";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.ts";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.ts";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.ts";

export const updateTodoHandler = Effect.fn("updateTodoHandler")(function* (cmd: UpdateTodoPayload) {
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

  const updated = TodoRootOps.update(existing, {
    title: cmd.title,
    completed: cmd.completed,
    now,
  });

  yield* repo.updateOne(updated);

  return updated;
});
