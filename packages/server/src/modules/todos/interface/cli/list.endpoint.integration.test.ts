import { deepStrictEqual } from "node:assert";

import { CliTodosContract, OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

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
  "GET /cli/orgs/:orgId/todos (integration)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("lists the org's todos via the CLI surface", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        deepStrictEqual((yield* client.cliTodos.list({ params: { orgId } })).length, 0);

        const created = yield* client.cliTodos.create({
          params: { orgId },
          payload: new CliTodosContract.CliCreateTodoPayload({ title: "Buy milk" }),
        });

        const todos = yield* client.cliTodos.list({ params: { orgId } });
        deepStrictEqual(
          todos.map((t) => t.id),
          [created.id],
        );
      }),
    );
  },
);
