import { assertNone, assertSome } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { TodoId } from "@/modules/todos/domain/todo/todo.id";
import { findTodoOrganizationHandler } from "@/modules/todos/queries/find-todo-organization.handler";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

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

describeIntegration(
  "findTodoOrganizationHandler (integration)",
  { layer: TestDatabaseLive, tables: ["todos.todos", "organization.organizations"] },
  (it) => {
    it.effect("returns the todo's organization when the ids match", () =>
      Effect.gen(function* () {
        yield* seed;
        const view = yield* findTodoOrganizationHandler({ organizationId: orgId, todoId });
        assertSome(view, { organizationId: orgId });
      }),
    );

    // Tenant isolation: the query pins both ids, so a real todo reached through
    // another org's path reads as absent rather than resolving.
    it.effect("returns null for a todo that lives in a different organization", () =>
      Effect.gen(function* () {
        yield* seed;
        const view = yield* findTodoOrganizationHandler({ organizationId: otherOrgId, todoId });
        assertNone(view);
      }),
    );

    it.effect("returns null for an unknown todo", () =>
      Effect.gen(function* () {
        yield* seed;

        const view = yield* findTodoOrganizationHandler({
          organizationId: orgId,
          todoId: unknownTodoId,
        });

        assertNone(view);
      }),
    );
  },
);
