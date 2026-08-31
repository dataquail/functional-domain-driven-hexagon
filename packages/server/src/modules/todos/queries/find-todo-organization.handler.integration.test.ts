import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import { beforeEach } from "vitest";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { findTodoOrganizationHandler } from "@/modules/todos/queries/find-todo-organization.handler.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const otherOrgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const todoId = TodoId.make("33333333-3333-3333-3333-333333333333");
const unknownTodoId = TodoId.make("44444444-4444-4444-4444-444444444444");

const seed = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES
          (${orgId}, 'Owner', now(), now(), null),
          (${otherOrgId}, 'Other', now(), now(), null)
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
        VALUES (${todoId}, ${orgId}, 'Buy milk', false, now(), now())
      `.pipe(Effect.orDie);
});

const suite = describe.sequential;

suite("findTodoOrganizationHandler (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("todos.todos", "organization.organizations").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it("returns the todo's organization when the ids match", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seed;
        const view = yield* findTodoOrganizationHandler({ organizationId: orgId, todoId });
        deepStrictEqual(view, { organizationId: orgId });
      }).pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  // Tenant isolation: the query pins both ids, so a real todo reached through
  // another org's path reads as absent rather than resolving.
  it("returns null for a todo that lives in a different organization", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seed;
        const view = yield* findTodoOrganizationHandler({ organizationId: otherOrgId, todoId });
        deepStrictEqual(view, null);
      }).pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it("returns null for an unknown todo", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seed;
        const view = yield* findTodoOrganizationHandler({
          organizationId: orgId,
          todoId: unknownTodoId,
        });
        deepStrictEqual(view, null);
      }).pipe(Effect.provide(TestDatabaseLive)),
    );
  });
});
