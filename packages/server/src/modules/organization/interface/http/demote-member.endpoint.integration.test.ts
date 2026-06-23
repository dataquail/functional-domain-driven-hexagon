import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

const ORG_ID = "11111111-1111-1111-1111-111111111111" as never;
const TARGET_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" as never;

// Seeds an org with `TARGET_ID` as a member. `asAdmin` additionally
// grants the `admin` role so demote has something to revoke.
const seedTargetMember = (asAdmin: boolean) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
          VALUES (${TARGET_ID}, 'target@test.local', 'USA', '3 St', '00000', now(), now())
          ON CONFLICT (id) DO NOTHING
        `),
      )
      .pipe(Effect.orDie);
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${ORG_ID}, 'Acme', now(), now(), null)
        `),
      )
      .pipe(Effect.orDie);
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "organization".memberships (user_id, organization_id, created_at)
          VALUES (${TARGET_ID}, ${ORG_ID}, now())
        `),
      )
      .pipe(Effect.orDie);
    if (asAdmin) {
      yield* db
        .execute((c) =>
          c.query(sql.unsafe`
            INSERT INTO "organization".organization_roles (organization_id, user_id, role, issued_by, created_at)
            VALUES (${ORG_ID}, ${TARGET_ID}, 'admin', ${SUPER_ADMIN_CALLER_ID}, now())
          `),
        )
        .pipe(Effect.orDie);
    }
  });

suite("DELETE /orgs/:orgId/members/:userId/admin (integration, super-admin caller)", () => {
  const { run } = useServerTestRuntime(
    [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    { seedSuperAdminCaller: true },
  );

  it("demotes an admin, reflected as isAdmin=false in the members list", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedTargetMember(true);
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.demoteMember({ path: { orgId: ORG_ID, userId: TARGET_ID } });

        const after = yield* client.organization.findMembers({ path: { orgId: ORG_ID } });
        const target = after.members.find((m) => m.userId === TARGET_ID);
        ok(target !== undefined);
        deepStrictEqual(target.isAdmin, false);
      }),
    );
  });

  it("returns 409 OrganizationRoleConflictError when the member is not an admin", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedTargetMember(false);
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.demoteMember({ path: { orgId: ORG_ID, userId: TARGET_ID } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          const error = exit.cause.error;
          ok(error instanceof OrganizationContract.OrganizationRoleConflictError);
          deepStrictEqual(error.reason, "not_admin");
        }
      }),
    );
  });
});

const memberSuite = hasTestDatabase ? describe.sequential : describe.skip;

memberSuite("DELETE /orgs/:orgId/members/:userId/admin (integration, plain-member caller)", () => {
  const { run } = useServerTestRuntime(
    [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  );

  it("returns 403 Forbidden when the caller is not an admin of the org", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedTargetMember(true);
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.demoteMember({ path: { orgId: ORG_ID, userId: TARGET_ID } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
