import { deepStrictEqual } from "node:assert";

import { CliTodosContract, OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.ts";
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
  "POST /cli/orgs/:orgId/todos/:id/complete (integration)",
  { tables: TODO_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("marks a todo done without resupplying its title", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const created = yield* client.cliTodos.create({
          params: { orgId },
          payload: new CliTodosContract.CliCreateTodoPayload({ title: "Buy milk" }),
        });

        const completed = yield* client.cliTodos.complete({
          params: { orgId, id: created.id },
        });

        deepStrictEqual(completed.completed, true);
        deepStrictEqual(completed.title, "Buy milk");
      }),
    );

    it.effect("fails CliTodoNotFoundError for an unknown todo", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const ghost = TodoId.make("00000000-0000-0000-0000-000000000000");

        const error = yield* client.cliTodos
          .complete({ params: { orgId, id: ghost } })
          .pipe(Effect.flip);

        deepStrictEqual(error._tag, "CliTodoNotFoundError");
      }),
    );
  },
);
