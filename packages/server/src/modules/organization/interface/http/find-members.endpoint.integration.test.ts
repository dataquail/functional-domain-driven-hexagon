import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { MEMBER_CALLER_ID, SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = describe.sequential;

const ORG_ID = "11111111-1111-1111-1111-111111111111" as never;
// A second, plain (non-admin) member, distinct from the seeded callers.
const ADMIN_MEMBER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" as never;

// Seeds an org with two members: the deterministic `MEMBER_CALLER_ID`
// (plain member, no role) and `ADMIN_MEMBER_ID` (holds the `admin`
// role). Org/membership/role rows are seeded directly because no
// single-caller HTTP path can assemble a multi-member org (create-org
// rejects super-admins, and accept needs the invitee's own session).
const seedOrgWithMembers = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((c) =>
      c.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${ADMIN_MEMBER_ID}, 'admin-member@test.local', 'USA', '3 St', '00000', now(), now())
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
        VALUES (${MEMBER_CALLER_ID}, ${ORG_ID}, now()), (${ADMIN_MEMBER_ID}, ${ORG_ID}, now())
      `),
    )
    .pipe(Effect.orDie);
  yield* db
    .execute((c) =>
      c.query(sql.unsafe`
        INSERT INTO "organization".organization_roles (organization_id, user_id, role, issued_by, created_at)
        VALUES (${ORG_ID}, ${ADMIN_MEMBER_ID}, 'admin', ${SUPER_ADMIN_CALLER_ID}, now())
      `),
    )
    .pipe(Effect.orDie);
});

suite("GET /orgs/:orgId/members (integration, super-admin caller)", () => {
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

  it("lists members enriched with email and the isAdmin flag", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrgWithMembers;
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organization.findMembers({ params: { orgId: ORG_ID } });

        deepStrictEqual(res.members.length, 2);
        const byId = new Map(res.members.map((m) => [m.userId, m]));
        const plain = byId.get(MEMBER_CALLER_ID);
        const admin = byId.get(ADMIN_MEMBER_ID);
        ok(plain !== undefined && admin !== undefined);
        deepStrictEqual(plain.email, "member@test.local");
        deepStrictEqual(plain.isAdmin, false);
        deepStrictEqual(admin.email, "admin-member@test.local");
        deepStrictEqual(admin.isAdmin, true);
      }),
    );
  });
});

const memberSuite = describe.sequential;

memberSuite("GET /orgs/:orgId/members (integration, plain-member caller)", () => {
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

  const seedOrg = Effect.gen(function* () {
    const db = yield* Database.Database;
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${ORG_ID}, 'Acme', now(), now(), null)
        `),
      )
      .pipe(Effect.orDie);
  });

  it("lets a plain member (no admin role) read the roster", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const db = yield* Database.Database;
        // The caller is a member but holds no `admin` role.
        yield* db
          .execute((c) =>
            c.query(sql.unsafe`
              INSERT INTO "organization".memberships (user_id, organization_id, created_at)
              VALUES (${MEMBER_CALLER_ID}, ${ORG_ID}, now())
            `),
          )
          .pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organization.findMembers({ params: { orgId: ORG_ID } });

        deepStrictEqual(res.members.length, 1);
        const self = res.members[0];
        ok(self !== undefined);
        deepStrictEqual(self.userId, MEMBER_CALLER_ID);
        // Viewing is allowed; the member is not an admin.
        deepStrictEqual(self.isAdmin, false);
      }),
    );
  });

  it("returns 403 Forbidden for a caller who is not a member of the org", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.findMembers({ params: { orgId: ORG_ID } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
