import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { OrganizationContract, TodosContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { Api } from "@/platform/api.js";
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
        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });
        const created = yield* client.todos.create({
          params: { orgId },
          payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
        });
        const updated = yield* client.todos.update({
          params: { orgId, id: created.id },
          payload: new TodosContract.UpdateTodoPayload({ title: "Buy oat milk", completed: true }),
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
        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });
        const ghostId = TodoId.make("00000000-0000-0000-0000-000000000000");
        const exit = yield* Effect.exit(
          client.todos.update({
            params: { orgId, id: ghostId },
            payload: new TodosContract.UpdateTodoPayload({ title: "x", completed: false }),
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              TodosContract.TodoNotFoundError,
          );
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
        const { id: orgA } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });
        const { id: orgB } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Beta" }),
        });
        const created = yield* client.todos.create({
          params: { orgId: orgA },
          payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
        });
        // Super-admin bypasses the membership gate for orgB, but the
        // repository is scoped by (orgId, todoId), so the todo created in
        // orgA can't be reached through orgB's path.
        const exit = yield* Effect.exit(
          client.todos.update({
            params: { orgId: orgB, id: created.id },
            payload: new TodosContract.UpdateTodoPayload({ title: "hijack", completed: true }),
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              TodosContract.TodoNotFoundError,
          );
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});

const nonMemberSuite = describe.sequential;

nonMemberSuite("PUT /orgs/:orgId/todos/:id (integration, non-member caller)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("returns 403 Forbidden for a caller who isn't a member of the todo's org", async () => {
    await run(
      Effect.gen(function* () {
        // Seeded directly: the caller cannot reach the create endpoints for an
        // org they are not a member of, and the resolver must find a real todo
        // so the denial comes from the policy rather than from NotFound.
        const orgId = "11111111-1111-1111-1111-111111111111" as never;
        const todoId = "33333333-3333-3333-3333-333333333333" as never;
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);
        yield* sql`
              INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
              VALUES (${todoId}, ${orgId}, 'Someone else''s todo', false, now(), now())
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.todos.update({
            params: { orgId, id: todoId },
            payload: new TodosContract.UpdateTodoPayload({ title: "Hijacked", completed: false }),
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              CustomHttpApiError.Forbidden,
          );
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
