import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type UpdateTodoCommand,
  type UpdateTodoOutput,
} from "@/modules/todos/commands/update-todo.command.js";
import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root.js";

export const updateTodo = (cmd: UpdateTodoCommand): UpdateTodoOutput =>
  Effect.gen(function* () {
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
