import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/repositories/todos.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { CompleteTodoCommand } from "./complete-todo.command.js";
import { completeTodo } from "./complete-todo.handler.js";

const todoId = TodoId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const otherOrgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const seed = Effect.gen(function* () {
  const repo = yield* TodosRepository;
  yield* repo.insertOne(
    TodoRootOps.create({ id: todoId, organizationId: orgId, title: "Buy milk", now }),
  );
});

describe("completeTodo", () => {
  it.effect("marks the todo done, preserving its title", () =>
    Effect.gen(function* () {
      yield* seed;
      const completed = yield* completeTodo(
        CompleteTodoCommand.make({ todoId, organizationId: orgId, userId }),
      );
      deepStrictEqual(completed.completed, true);
      deepStrictEqual(completed.title, "Buy milk");
      const stored = yield* (yield* TodosRepository).findOneById(orgId, todoId);
      deepStrictEqual(stored.completed, true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound for an unknown todo", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        completeTodo(CompleteTodoCommand.make({ todoId, organizationId: orgId, userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof TodoNotFound, true);
      }
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound across a tenant boundary", () =>
    Effect.gen(function* () {
      yield* seed;
      const exit = yield* Effect.exit(
        completeTodo(CompleteTodoCommand.make({ todoId, organizationId: otherOrgId, userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
