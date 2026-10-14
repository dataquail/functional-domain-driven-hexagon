import { deepStrictEqual, ok } from "node:assert";

import { OrganizationContract, TodosContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { Api } from "@/globals/infrastructure/framework/http/api";
import { TodoId } from "@/modules/todos/domain/todo/todo.id";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

const TODO_TABLES = [
  "todos.todos",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describeServer(
  "DELETE /orgs/:orgId/todos/:id (integration)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("removes the todo", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const created = yield* client.todos.create({
          params: { orgId },
          payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
        });

        yield* client.todos.delete({ params: { orgId, id: created.id } });
        const todos = yield* client.todos.get({ params: { orgId } });
        deepStrictEqual(todos.length, 0);
      }),
    );

    it.effect("returns 404 TodoNotFoundError for an unknown id", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const ghostId = TodoId.make("00000000-0000-0000-0000-000000000000");
        const error = yield* Effect.flip(client.todos.delete({ params: { orgId, id: ghostId } }));
        ok(Schema.is(TodosContract.TodoNotFoundError)(error));
      }),
    );

    it.effect("returns 404 when deleting via a different org's path (tenant isolation)", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgA } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const { id: orgB } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Beta" }),
        });

        const created = yield* client.todos.create({
          params: { orgId: orgA },
          payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
        });

        const error = yield* Effect.flip(
          client.todos.delete({ params: { orgId: orgB, id: created.id } }),
        );

        ok(Schema.is(TodosContract.TodoNotFoundError)(error));

        // The todo is still present under its real org.
        const todos = yield* client.todos.get({ params: { orgId: orgA } });
        deepStrictEqual(todos.length, 1);
      }),
    );
  },
);

describeServer(
  "DELETE /orgs/:orgId/todos/:id (integration, non-member caller)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns 403 Forbidden for a caller who isn't a member of the todo's org", () =>
      Effect.gen(function* () {
        // Seeded directly: the caller cannot reach the create endpoints for an
        // org they are not a member of, and the resolver must find a real todo
        // so the denial comes from the policy rather than from NotFound.
        const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
        const todoId = TodoId.make("33333333-3333-3333-3333-333333333333");
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);
        yield* sql`
              INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
              VALUES (${todoId}, ${orgId}, 'Someone else''s todo', false, now(), now())
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const error = yield* Effect.flip(client.todos.delete({ params: { orgId, id: todoId } }));
        ok(Schema.is(CustomHttpApiError.Forbidden)(error));
      }),
    );
  },
);
