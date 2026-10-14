import { deepStrictEqual, ok } from "node:assert";

import { OrganizationContract, TodosContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";
import { TestServerLiveAsMember } from "@/test-utils/test-server.ts";

const TODO_TABLES = [
  "todos.todos",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describeServer(
  "POST /orgs/:orgId/todos (integration)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("creates a todo in the org and returns the persisted shape", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const res = yield* client.todos.create({
          params: { orgId },
          payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
        });

        ok(res.id.length > 0);
        deepStrictEqual(res.title, "Buy milk");
        deepStrictEqual(res.completed, false);
      }),
    );
  },
);

describeServer(
  "POST /orgs/:orgId/todos (integration, non-member caller)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns 403 Forbidden for a caller who isn't a member of the org", () =>
      Effect.gen(function* () {
        const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);

        const error = yield* Effect.flip(
          client.todos.create({
            params: { orgId },
            payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
          }),
        );

        ok(Schema.is(CustomHttpApiError.Forbidden)(error));
      }),
    );
  },
);
