import { deepStrictEqual, ok } from "node:assert";

import { OrganizationId } from "@org/contracts/EntityIds";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware";
import { describeServer } from "@/test-utils/server-test-runtime";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const seedOrg = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
});

const seedCallerMembership = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".memberships (user_id, organization_id, created_at)
        VALUES (${SUPER_ADMIN_CALLER_ID}, ${ORG_ID}, now())
      `.pipe(Effect.orDie);
});

describeServer(
  "POST /orgs/:orgId/leave (integration)",
  {
    tables: [
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    seedSuperAdminCaller: true,
  },
  (it) => {
    it.effect("removes the caller's membership", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedCallerMembership;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.leave({ params: { orgId: ORG_ID } });

        const after = yield* client.organization.findMembers({ params: { orgId: ORG_ID } });
        const stillMember = after.members.some((m) => m.userId === SUPER_ADMIN_CALLER_ID);
        deepStrictEqual(stillMember, false);
      }),
    );

    it.effect("returns 404 when the caller is not a member", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.organization.leave({ params: { orgId: ORG_ID } }));
        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag,
            "MembershipNotFoundError",
          );
        }
      }),
    );
  },
);
