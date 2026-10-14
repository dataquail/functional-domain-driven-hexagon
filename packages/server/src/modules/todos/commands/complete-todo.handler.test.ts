import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { Spec } from "@/globals/application/ddd/specification";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors";
import { TodoId } from "@/modules/todos/domain/todo/todo.id";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/repositories/todos.repository-fake";

import { completeTodoHandler } from "./complete-todo.handler";

const todoId = TodoId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const otherOrgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const seed = Effect.gen(function* () {
  const repo = yield* TodosRepository;
  yield* repo.insertOne(
    TodoRootOps.create({ id: todoId, organizationId: orgId, title: "Buy milk", now }),
  );
});

describe("completeTodoHandler", () => {
  it.effect("marks the todo done, preserving its title", () =>
    Effect.gen(function* () {
      yield* seed;
      const completed = yield* completeTodoHandler({ todoId, organizationId: orgId, userId });
      deepStrictEqual(completed.completed, true);
      deepStrictEqual(completed.title, "Buy milk");

      const stored = yield* Effect.map(
        (yield* TodosRepository).findOne(
          Spec.and(TodoSpecifications.withId(todoId), TodoSpecifications.forOrganization(orgId)),
        ),
        Option.getOrThrow,
      );

      deepStrictEqual(stored.completed, true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound for an unknown todo", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        completeTodoHandler({ todoId, organizationId: orgId, userId }),
      );

      deepStrictEqual(Schema.is(TodoNotFound)(error), true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound across a tenant boundary", () =>
    Effect.gen(function* () {
      yield* seed;

      const exit = yield* Effect.exit(
        completeTodoHandler({ todoId, organizationId: otherOrgId, userId }),
      );

      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
