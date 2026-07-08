import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const TODO_TABLES = [
  "todos.todos",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

const suite = describe.sequential;

suite("DELETE /cli/orgs/:orgId/todos/:id (integration)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("removes a todo so it drops out of the listing", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const created = yield* client.cliTodos.create({
          params: { orgId },
          payload: { title: "Buy milk" },
        });
        yield* client.cliTodos.remove({ params: { orgId, id: created.id } });
        deepStrictEqual((yield* client.cliTodos.list({ params: { orgId } })).length, 0);
      }),
    );
  });

  it("fails CliTodoNotFoundError for an unknown todo", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const ghost = TodoId.make("00000000-0000-0000-0000-000000000000");
        const error = yield* client.cliTodos
          .remove({ params: { orgId, id: ghost } })
          .pipe(Effect.flip);
        deepStrictEqual(error._tag, "CliTodoNotFoundError");
      }),
    );
  });
});
