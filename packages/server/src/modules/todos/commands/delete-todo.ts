import {
  type DeleteTodoCommand,
  type DeleteTodoOutput,
} from "@/modules/todos/commands/delete-todo-command.js";
import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import { TodosNotifier } from "@/modules/todos/domain/todos-notifier.js";
import * as Effect from "effect/Effect";

export const deleteTodo = (cmd: DeleteTodoCommand): DeleteTodoOutput =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    const notifier = yield* TodosNotifier;
    yield* repo.remove(cmd.todoId);
    yield* notifier.notifyDeleted({ userId: cmd.userId, todoId: cmd.todoId }).pipe(Effect.ignore);
  });
