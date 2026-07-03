import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todo.repository.js";
import { TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/repositories/todos.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { UpdateTodoCommand } from "./update-todo.command.js";
import { updateTodo } from "./update-todo.handler.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const aliceUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const otherOrgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const seed = Effect.gen(function* () {
  const repo = yield* TodosRepository;
  const todo = TodoRootOps.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now });
  yield* repo.insertOne(todo);
});

describe("updateTodo", () => {
  it.effect("overwrites title and completed and returns the updated todo", () =>
    Effect.gen(function* () {
      yield* seed;
      const updated = yield* updateTodo(
        UpdateTodoCommand.make({
          todoId: aliceId,
          organizationId: orgId,
          title: "Buy oat milk",
          completed: true,
          userId: aliceUserId,
        }),
      );
      deepStrictEqual(updated.title, "Buy oat milk");
      deepStrictEqual(updated.completed, true);

      const repo = yield* TodosRepository;
      const stored = yield* repo.findOneById(orgId, aliceId);
      deepStrictEqual(stored.title, "Buy oat milk");
      deepStrictEqual(stored.completed, true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound when the todo doesn't exist", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        updateTodo(
          UpdateTodoCommand.make({
            todoId: aliceId,
            organizationId: orgId,
            title: "x",
            completed: false,
            userId: aliceUserId,
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof TodoNotFound, true);
      }
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound when the todo belongs to a different org (tenant isolation)", () =>
    Effect.gen(function* () {
      yield* seed;
      const exit = yield* Effect.exit(
        updateTodo(
          UpdateTodoCommand.make({
            todoId: aliceId,
            organizationId: otherOrgId,
            title: "x",
            completed: false,
            userId: aliceUserId,
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof TodoNotFound, true);
      }
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
