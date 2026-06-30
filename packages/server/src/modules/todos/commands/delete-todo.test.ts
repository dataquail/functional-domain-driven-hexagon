import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todo-repository.js";
import * as Todo from "@/modules/todos/domain/todo.js";
import { TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { deleteTodo } from "./delete-todo.js";
import { DeleteTodoCommand } from "./delete-todo-command.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const aliceUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const otherOrgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

describe("deleteTodo", () => {
  it.effect("removes the todo from the repository", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      yield* repo.insertOne(
        Todo.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now }),
      );
      yield* deleteTodo(
        DeleteTodoCommand.make({ todoId: aliceId, organizationId: orgId, userId: aliceUserId }),
      );
      const exit = yield* Effect.exit(repo.findOneById(orgId, aliceId));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound when the todo doesn't exist", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        deleteTodo(
          DeleteTodoCommand.make({ todoId: aliceId, organizationId: orgId, userId: aliceUserId }),
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
      const repo = yield* TodosRepository;
      yield* repo.insertOne(
        Todo.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now }),
      );
      const exit = yield* Effect.exit(
        deleteTodo(
          DeleteTodoCommand.make({
            todoId: aliceId,
            organizationId: otherOrgId,
            userId: aliceUserId,
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof TodoNotFound, true);
      }
      // The original (correct-org) row is untouched.
      const stillThere = yield* repo.findOneById(orgId, aliceId);
      deepStrictEqual(stillThere.id, aliceId);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
