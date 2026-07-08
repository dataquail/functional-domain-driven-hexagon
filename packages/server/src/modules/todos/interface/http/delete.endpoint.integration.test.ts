import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { TodosContract } from "@org/contracts/api/Contracts";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

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

suite("DELETE /orgs/:orgId/todos/:id (integration)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("removes the todo", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const created = yield* client.todos.create({
          path: { orgId },
          payload: { title: "Buy milk" },
        });
        yield* client.todos.delete({ path: { orgId, id: created.id } });
        const todos = yield* client.todos.get({ path: { orgId } });
        deepStrictEqual(todos.length, 0);
      }),
    );
  });

  it("returns 404 TodoNotFoundError for an unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const ghostId = TodoId.make("00000000-0000-0000-0000-000000000000");
        const exit = yield* Effect.exit(client.todos.delete({ path: { orgId, id: ghostId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof TodosContract.TodoNotFoundError);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });

  it("returns 404 when deleting via a different org's path (tenant isolation)", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgA } = yield* client.organization.create({ payload: { name: "Acme" } });
        const { id: orgB } = yield* client.organization.create({ payload: { name: "Beta" } });
        const created = yield* client.todos.create({
          path: { orgId: orgA },
          payload: { title: "Buy milk" },
        });
        const exit = yield* Effect.exit(
          client.todos.delete({ path: { orgId: orgB, id: created.id } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof TodosContract.TodoNotFoundError);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
        // The todo is still present under its real org.
        const todos = yield* client.todos.get({ path: { orgId: orgA } });
        deepStrictEqual(todos.length, 1);
      }),
    );
  });
});
