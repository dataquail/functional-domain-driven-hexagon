import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { Spec } from "@/globals/application/ddd/specification.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.js";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/repositories/todos.repository-fake.js";
import { CryptoFake } from "@/test-utils/crypto-fake.js";

import { createTodoHandler } from "./create-todo.handler.js";

const TestLayer = Layer.mergeAll(TodosRepositoryFake, CryptoFake);

const aliceUserId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

describe("createTodoHandler", () => {
  it.effect("inserts a todo scoped to the org with completed=false and returns it", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;

      const todo = yield* createTodoHandler({
        title: "Buy milk",
        organizationId: orgId,
        userId: aliceUserId,
      });

      deepStrictEqual(todo.title, "Buy milk");
      deepStrictEqual(todo.completed, false);
      deepStrictEqual(todo.organizationId, orgId);

      const stored = yield* Effect.map(
        repo.findOne(
          Spec.and(TodoSpecifications.withId(todo.id), TodoSpecifications.forOrganization(orgId)),
        ),
        Option.getOrThrow,
      );

      deepStrictEqual(stored.title, "Buy milk");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("each call gets a unique id", () =>
    Effect.gen(function* () {
      const a = yield* createTodoHandler({
        title: "A",
        organizationId: orgId,
        userId: aliceUserId,
      });

      const b = yield* createTodoHandler({
        title: "B",
        organizationId: orgId,
        userId: aliceUserId,
      });

      deepStrictEqual(a.id === b.id, false);
    }).pipe(Effect.provide(TestLayer)),
  );
});
