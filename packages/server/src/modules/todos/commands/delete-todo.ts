import {
  type DeleteTodoCommand,
  type DeleteTodoOutput,
} from "@/modules/todos/commands/delete-todo-command.js";
import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import * as Effect from "effect/Effect";

export const deleteTodo = (cmd: DeleteTodoCommand): DeleteTodoOutput =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    yield* repo.remove(cmd.todoId);
  });
