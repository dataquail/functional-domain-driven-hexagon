import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { Spec } from "@/globals/application/ddd/specification.ts";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.ts";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.ts";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.ts";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.ts";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.ts";
import { TodosRepositoryFake } from "@/modules/todos/infrastructure/repositories/todos.repository-fake.ts";

import { deleteTodoHandler } from "./delete-todo.handler.ts";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const aliceUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const otherOrgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

describe("deleteTodoHandler", () => {
  it.effect("removes the todo from the repository", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      yield* repo.insertOne(
        TodoRootOps.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now }),
      );
      yield* deleteTodoHandler({ todoId: aliceId, organizationId: orgId, userId: aliceUserId });

      const found = yield* repo.findOne(
        Spec.and(TodoSpecifications.withId(aliceId), TodoSpecifications.forOrganization(orgId)),
      );

      assertNone(found);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound when the todo doesn't exist", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        deleteTodoHandler({ todoId: aliceId, organizationId: orgId, userId: aliceUserId }),
      );

      deepStrictEqual(Schema.is(TodoNotFound)(error), true);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );

  it.effect("fails TodoNotFound when the todo belongs to a different org (tenant isolation)", () =>
    Effect.gen(function* () {
      const repo = yield* TodosRepository;
      yield* repo.insertOne(
        TodoRootOps.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now }),
      );

      const error = yield* Effect.flip(
        deleteTodoHandler({
          todoId: aliceId,
          organizationId: otherOrgId,
          userId: aliceUserId,
        }),
      );

      deepStrictEqual(Schema.is(TodoNotFound)(error), true);

      // The original (correct-org) row is untouched.
      const stillThere = yield* Effect.map(
        repo.findOne(
          Spec.and(TodoSpecifications.withId(aliceId), TodoSpecifications.forOrganization(orgId)),
        ),
        Option.getOrThrow,
      );

      deepStrictEqual(stillThere.id, aliceId);
    }).pipe(Effect.provide(TodosRepositoryFake)),
  );
});
