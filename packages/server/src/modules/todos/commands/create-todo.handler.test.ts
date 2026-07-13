import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/repositories/todos.repository-fake.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { CreateTodoCommand } from "./create-todo.command.js";
import { createTodo } from "./create-todo.handler.js";

const aliceUserId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

describe("createTodo", () => {
  it.effect("inserts a todo scoped to the org with completed=false and returns it", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      const todo = yield* createTodo(
        CreateTodoCommand.make({ title: "Buy milk", organizationId: orgId, userId: aliceUserId }),
      );
      deepStrictEqual(todo.title, "Buy milk");
      deepStrictEqual(todo.completed, false);
      deepStrictEqual(todo.organizationId, orgId);
      const stored = yield* repo.findOne(
        Spec.and(TodoSpecifications.withId(todo.id), TodoSpecifications.forOrganization(orgId)),
      );
      if (stored === null) throw new Error("expected stored todo");
      deepStrictEqual(stored.title, "Buy milk");
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("each call gets a unique id", () =>
    Effect.gen(function* () {
      const a = yield* createTodo(
        CreateTodoCommand.make({ title: "A", organizationId: orgId, userId: aliceUserId }),
      );
      const b = yield* createTodo(
        CreateTodoCommand.make({ title: "B", organizationId: orgId, userId: aliceUserId }),
      );
      deepStrictEqual(a.id === b.id, false);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
