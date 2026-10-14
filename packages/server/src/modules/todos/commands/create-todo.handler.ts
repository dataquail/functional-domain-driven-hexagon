import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type CreateTodoPayload } from "@/modules/todos/commands/create-todo.command.js";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";

export const createTodoHandler = Effect.fn("createTodoHandler")(function* (cmd: CreateTodoPayload) {
  const repo = yield* TodosRepository;
  const crypto = yield* Crypto.Crypto;
  const id = TodoId.make(yield* Effect.orDie(crypto.randomUUIDv4));
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
