import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

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

suite("GET /orgs/:orgId/todos (integration)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("lists only the org's todos, created_at desc", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });

        const empty = yield* client.todos.get({ path: { orgId } });
        deepStrictEqual(empty.length, 0);

        yield* client.todos.create({ path: { orgId }, payload: { title: "first" } });
        yield* client.todos.create({ path: { orgId }, payload: { title: "second" } });
        yield* client.todos.create({ path: { orgId }, payload: { title: "third" } });

        const todos = yield* client.todos.get({ path: { orgId } });
        deepStrictEqual(
          todos.map((t) => t.title),
          ["third", "second", "first"],
        );
      }),
    );
  });
});

// Non-member caller (not super-admin) is rejected before any query.
const memberSuite = describe.sequential;

memberSuite("GET /orgs/:orgId/todos (integration, non-member caller)", () => {
  const { run } = useServerTestRuntime(TODO_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("returns 403 Forbidden for a caller who isn't a member of the org", async () => {
    await run(
      Effect.gen(function* () {
        // Seed an org directly so the member-caller is NOT a member of it.
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
        const exit = yield* Effect.exit(client.todos.get({ path: { orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
