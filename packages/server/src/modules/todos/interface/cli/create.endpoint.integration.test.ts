import { deepStrictEqual, ok } from "node:assert";

import { CliTodosContract, OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const TODO_TABLES = [
  "todos.todos",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describeServer(
  "POST /cli/orgs/:orgId/todos (integration)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("creates a todo via the CLI surface and returns the CliTodo shape", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const todo = yield* client.cliTodos.create({
          params: { orgId },
          payload: new CliTodosContract.CliCreateTodoPayload({ title: "Buy milk" }),
        });

        deepStrictEqual(todo.title, "Buy milk");
        deepStrictEqual(todo.completed, false);
        ok(todo.id.length > 0);
      }),
    );
  },
);
