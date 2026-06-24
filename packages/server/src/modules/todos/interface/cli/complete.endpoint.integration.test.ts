import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const TODO_TABLES = [
  "todos.todos",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("POST /cli/orgs/:orgId/todos/:id/complete (integration)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("marks a todo done without resupplying its title", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const created = yield* client.cliTodos.create({
          path: { orgId },
          payload: { title: "Buy milk" },
        });
        const completed = yield* client.cliTodos.complete({
          path: { orgId, id: created.id },
        });
        deepStrictEqual(completed.completed, true);
        deepStrictEqual(completed.title, "Buy milk");
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
          .complete({ path: { orgId, id: ghost } })
          .pipe(Effect.flip);
        deepStrictEqual(error._tag, "CliTodoNotFoundError");
      }),
    );
  });
});
