import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type CompleteTodoCommand,
  type CompleteTodoOutput,
} from "@/modules/todos/commands/complete-todo-command.js";
import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";

export const completeTodo = (cmd: CompleteTodoCommand): CompleteTodoOutput =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    const existing = yield* repo.findById(cmd.organizationId, cmd.todoId);
    const now = yield* DateTime.now;
    const completed = Todo.complete(existing, now);
    yield* repo.update(completed);
    return completed;
  });
