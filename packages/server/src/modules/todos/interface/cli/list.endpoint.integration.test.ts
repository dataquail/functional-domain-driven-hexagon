import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
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

suite("GET /cli/orgs/:orgId/todos (integration)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("lists the org's todos via the CLI surface", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        deepStrictEqual((yield* client.cliTodos.list({ params: { orgId } })).length, 0);
        const created = yield* client.cliTodos.create({
          params: { orgId },
          payload: { title: "Buy milk" },
        });
        const todos = yield* client.cliTodos.list({ params: { orgId } });
        deepStrictEqual(
          todos.map((t) => t.id),
          [created.id],
        );
      }),
    );
  });
});
