import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
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

suite("PUT /orgs/:orgId/todos/:id (integration)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("updates title and completed", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const created = yield* client.todos.create({
          path: { orgId },
          payload: { title: "Buy milk" },
        });
        const updated = yield* client.todos.update({
          path: { orgId, id: created.id },
          payload: { title: "Buy oat milk", completed: true },
        });
        deepStrictEqual(updated.title, "Buy oat milk");
        deepStrictEqual(updated.completed, true);
      }),
    );
  });

  it("returns 404 TodoNotFoundError for an unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const ghostId = TodoId.make("00000000-0000-0000-0000-000000000000");
        const exit = yield* Effect.exit(
          client.todos.update({
            path: { orgId, id: ghostId },
            payload: { title: "x", completed: false },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof TodosContract.TodoNotFoundError);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });

  it("returns 404 when updating via a different org's path (tenant isolation)", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgA } = yield* client.organization.create({ payload: { name: "Acme" } });
        const { id: orgB } = yield* client.organization.create({ payload: { name: "Beta" } });
        const created = yield* client.todos.create({
          path: { orgId: orgA },
          payload: { title: "Buy milk" },
        });
        // Super-admin bypasses the membership gate for orgB, but the
        // repository is scoped by (orgId, todoId), so the todo created in
        // orgA can't be reached through orgB's path.
        const exit = yield* Effect.exit(
          client.todos.update({
            path: { orgId: orgB, id: created.id },
            payload: { title: "hijack", completed: true },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof TodosContract.TodoNotFoundError);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
