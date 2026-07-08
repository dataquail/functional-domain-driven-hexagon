import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
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
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const DeletedAtRowStd = Schema.standardSchemaV1(
  Schema.Struct({ deleted_at: Schema.NullOr(Schema.DateTimeUtcFromDate) }),
);

const suite = describe.sequential;

suite("DELETE /orgs/:id (integration)", () => {
  // Tombstoning an org is super-admin-only (organizationPolicies.delete =
  // SuperAdminOnly), so this suite runs as the default super-admin caller.
  // Super-admins can't create orgs, so the target org is seeded directly.
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  const seededOrgId = "11111111-1111-1111-1111-111111111111" as never;
  const seedOrg = (id: string, name: string) =>
    Effect.gen(function* () {
      const db = yield* Database.Database;
      yield* db
        .execute((c) =>
          c.query(sql.unsafe`
            INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
            VALUES (${id}, ${name}, now(), now(), null)
          `),
        )
        .pipe(Effect.orDie);
    });

  it("tombstones the org", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg(seededOrgId, "Acme");
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.softDelete({ path: { id: seededOrgId } });
        const db = yield* Database.Database;
        const rows = yield* db
          .execute((c) =>
            c.any(sql.type(DeletedAtRowStd)`
              SELECT deleted_at FROM "organization".organizations WHERE id = ${seededOrgId}
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
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof OrganizationContract.OrganizationNotFoundError);
        }
      }),
    );
  });
});

const memberSuite = describe.sequential;

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
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
