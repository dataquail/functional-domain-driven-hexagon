import {
  type CreateTodoCommand,
  type CreateTodoOutput,
} from "@/modules/todos/commands/create-todo-command.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

export const createTodo = (cmd: CreateTodoCommand): CreateTodoOutput =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    const id = TodoId.make(yield* Effect.sync(() => crypto.randomUUID()));
    yield* Effect.annotateCurrentSpan("todo.id", id);
    const now = yield* DateTime.now;
    const todo = Todo.create({ id, title: cmd.title, now });
    yield* repo.insert(todo);
    return todo;
  });
