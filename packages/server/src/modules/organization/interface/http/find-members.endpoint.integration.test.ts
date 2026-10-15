import { deepStrictEqual, ok } from "node:assert";

import { assertDefined } from "@effect/vitest/utils";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { OrganizationId, UserId } from "@org/contracts/EntityIds";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { MEMBER_CALLER_ID, SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");

// A second, plain (non-admin) member, distinct from the seeded callers.
const ADMIN_MEMBER_ID = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

// Seeds an org with two members: the deterministic `MEMBER_CALLER_ID`
// (plain member, no role) and `ADMIN_MEMBER_ID` (holds the `admin`
// role). Org/membership/role rows are seeded directly because no
// single-caller HTTP path can assemble a multi-member org (create-org
// rejects super-admins, and accept needs the invitee's own session).
const seedOrgWithMembers = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${ADMIN_MEMBER_ID}, 'admin-member@test.local', 'USA', '3 St', '00000', now(), now())
        ON CONFLICT (id) DO NOTHING
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "organization".memberships (user_id, organization_id, created_at)
        VALUES (${MEMBER_CALLER_ID}, ${ORG_ID}, now()), (${ADMIN_MEMBER_ID}, ${ORG_ID}, now())
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "organization".organization_roles (organization_id, user_id, role, issued_by, created_at)
        VALUES (${ORG_ID}, ${ADMIN_MEMBER_ID}, 'admin', ${SUPER_ADMIN_CALLER_ID}, now())
      `.pipe(Effect.orDie);
});

describeServer(
  "GET /orgs/:orgId/members (integration, super-admin caller)",
  {
    tables: [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    seedSuperAdminCaller: true,
  },
  (it) => {
    it.effect("lists members enriched with email and the isAdmin flag", () =>
      Effect.gen(function* () {
        yield* seedOrgWithMembers;
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organization.findMembers({ params: { orgId: ORG_ID } });

        deepStrictEqual(res.members.length, 2);
        const byId = new Map(res.members.map((m) => [m.userId, m]));
        const plain = byId.get(MEMBER_CALLER_ID);
        const admin = byId.get(ADMIN_MEMBER_ID);
        assertDefined(plain);
        assertDefined(admin);
        deepStrictEqual(plain.email, "member@test.local");
        deepStrictEqual(plain.isAdmin, false);
        deepStrictEqual(admin.email, "admin-member@test.local");
        deepStrictEqual(admin.isAdmin, true);
      }),
    );
  },
);

describeServer(
  "GET /orgs/:orgId/members (integration, plain-member caller)",
  {
    tables: [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  },
  (it) => {
    const seedOrg = Effect.gen(function* () {
      const sql = yield* Database.Database;
      yield* sql`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${ORG_ID}, 'Acme', now(), now(), null)
        `.pipe(Effect.orDie);
    });

    it.effect("lets a plain member (no admin role) read the roster", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const sql = yield* Database.Database;
        // The caller is a member but holds no `admin` role.
        yield* sql`
              INSERT INTO "organization".memberships (user_id, organization_id, created_at)
              VALUES (${MEMBER_CALLER_ID}, ${ORG_ID}, now())
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organization.findMembers({ params: { orgId: ORG_ID } });

        deepStrictEqual(res.members.length, 1);
        const self = res.members[0];
        assertDefined(self);
        deepStrictEqual(self.userId, MEMBER_CALLER_ID);
        // Viewing is allowed; the member is not an admin.
        deepStrictEqual(self.isAdmin, false);
      }),
    );

    it.effect("returns 403 Forbidden for a caller who is not a member of the org", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.findMembers({ params: { orgId: ORG_ID } }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Schema.is(CustomHttpApiError.Forbidden)(
              Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow),
            ),
          );
        }
      }),
    );
  },
);
