import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type CreateTodoCommand,
  type CreateTodoOutput,
} from "@/modules/todos/commands/create-todo.command.js";
import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root.js";

export const createTodo = (cmd: CreateTodoCommand): CreateTodoOutput =>
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    const id = TodoId.make(yield* Effect.sync(() => crypto.randomUUID()));
    yield* Effect.annotateCurrentSpan("todo.id", id);
    const now = yield* DateTime.now;
    const todo = TodoRootOps.create({
      id,
      organizationId: cmd.organizationId,
      title: cmd.title,
      now,
    });
    yield* repo.insertOne(todo);
    return todo;
  });
