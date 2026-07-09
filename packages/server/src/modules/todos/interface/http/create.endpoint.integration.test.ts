import { describe, it } from "@effect/vitest";
import { OrganizationContract, TodosContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
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

suite("POST /orgs/:orgId/todos (integration)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("creates a todo in the org and returns the persisted shape", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });
        const res = yield* client.todos.create({
          params: { orgId },
          payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
        });
        ok(typeof res.id === "string" && res.id.length > 0);
        deepStrictEqual(res.title, "Buy milk");
        deepStrictEqual(res.completed, false);
      }),
    );
  });
});

const memberSuite = describe.sequential;

memberSuite("POST /orgs/:orgId/todos (integration, non-member caller)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("returns 403 Forbidden for a caller who isn't a member of the org", async () => {
    await run(
      Effect.gen(function* () {
        const orgId = "11111111-1111-1111-1111-111111111111" as never;
        const db = yield* Database.Database;
        yield* db
          .execute((c) =>
            c.query(sql.unsafe`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `),
          )
          .pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.todos.create({
            params: { orgId },
            payload: new TodosContract.CreateTodoPayload({ title: "Buy milk" }),
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
