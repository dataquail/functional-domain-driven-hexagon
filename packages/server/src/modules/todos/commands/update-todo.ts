import {
  type UpdateTodoCommand,
  type UpdateTodoOutput,
} from "@/modules/todos/commands/update-todo-command.js";
import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

export const updateTodo = (cmd: UpdateTodoCommand): UpdateTodoOutput =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    const existing = yield* repo.findById(cmd.todoId);
    const now = yield* DateTime.now;
    const updated = Todo.update(existing, {
      title: cmd.title,
      completed: cmd.completed,
      now,
    });
    yield* repo.update(updated);
    return updated;
  });
