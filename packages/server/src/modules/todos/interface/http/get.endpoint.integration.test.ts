import { deepStrictEqual, ok } from "node:assert";

import { OrganizationContract, TodosContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { Api } from "@/globals/infrastructure/framework/http/api";
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
  "GET /orgs/:orgId/todos (integration)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("lists only the org's todos, created_at desc", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const empty = yield* client.todos.get({ params: { orgId } });
        deepStrictEqual(empty.length, 0);

        yield* client.todos.create({
          params: { orgId },
          payload: new TodosContract.CreateTodoPayload({ title: "first" }),
        });
        yield* client.todos.create({
          params: { orgId },
          payload: new TodosContract.CreateTodoPayload({ title: "second" }),
        });
        yield* client.todos.create({
          params: { orgId },
          payload: new TodosContract.CreateTodoPayload({ title: "third" }),
        });

        const todos = yield* client.todos.get({ params: { orgId } });
        deepStrictEqual(
          todos.map((t) => t.title),
          ["third", "second", "first"],
        );
      }),
    );
  },
);

// Non-member caller (not super-admin) is rejected before any query.

describeServer(
  "GET /orgs/:orgId/todos (integration, non-member caller)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns 403 Forbidden for a caller who isn't a member of the org", () =>
      Effect.gen(function* () {
        // Seed an org directly so the member-caller is NOT a member of it.
        const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const error = yield* Effect.flip(client.todos.get({ params: { orgId } }));
        ok(Schema.is(CustomHttpApiError.Forbidden)(error));
      }),
    );
  },
);
