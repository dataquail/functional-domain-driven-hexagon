import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type CompleteTodoCommand,
  type CompleteTodoOutput,
} from "@/modules/todos/commands/complete-todo.command.js";
import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root.js";

export const completeTodo = (cmd: CompleteTodoCommand): CompleteTodoOutput =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    const existing = yield* repo.findOneById(cmd.organizationId, cmd.todoId);
    const now = yield* DateTime.now;
    const completed = TodoRootOps.complete(existing, now);
    yield* repo.updateOne(completed);
    return completed;
  });
