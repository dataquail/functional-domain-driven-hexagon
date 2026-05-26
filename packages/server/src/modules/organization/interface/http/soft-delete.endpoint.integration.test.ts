import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const DeletedAtRowStd = Schema.standardSchemaV1(
  Schema.Struct({ deleted_at: Schema.NullOr(Schema.DateTimeUtcFromDate) }),
);

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("DELETE /orgs/:id (integration)", () => {
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("tombstones the org", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.organization.create({ payload: { name: "Acme" } });
        yield* client.organization.softDelete({ path: { id } });
        const db = yield* Database.Database;
        const rows = yield* db
          .execute((c) =>
            c.any(sql.type(DeletedAtRowStd)`
              SELECT deleted_at FROM "organization".organizations WHERE id = ${id}
            `),
          )
          .pipe(Effect.orDie);
        deepStrictEqual(rows.length, 1);
        ok(rows[0]?.deleted_at !== null);
      }),
    );
  });

  it("returns 404 OrganizationNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.softDelete({
            path: { id: "00000000-0000-0000-0000-000000000000" as never },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof OrganizationContract.OrganizationNotFoundError);
        }
      }),
    );
  });
});

const memberSuite = hasTestDatabase ? describe.sequential : describe.skip;

memberSuite("DELETE /orgs/:id (integration, non-super-admin caller)", () => {
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  );

  it("returns 403 Forbidden", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.organization.create({ payload: { name: "Acme" } });
        const exit = yield* Effect.exit(client.organization.softDelete({ path: { id } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
