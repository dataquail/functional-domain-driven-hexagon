import { deepStrictEqual, ok } from "node:assert";

import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { OrganizationId } from "@org/contracts/EntityIds";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { MEMBER_CALLER_ID } from "@/test-utils/fake-auth-middleware";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const UNKNOWN_ORG_ID = OrganizationId.make("99999999-9999-9999-9999-999999999999");

// The seeded member caller doubles as the removal target — its user row is
// inserted by `seedSuperAdminCaller`, so no extra user fixture is needed.
const TARGET_ID = MEMBER_CALLER_ID;

const seedOrg = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
});

const seedTargetMembership = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".memberships (user_id, organization_id, created_at)
        VALUES (${TARGET_ID}, ${ORG_ID}, now())
      `.pipe(Effect.orDie);
});

describeServer(
  "DELETE /orgs/:orgId/members/:userId (integration, super-admin caller)",
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
    it.effect("removes the target member from the org", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedTargetMembership;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.removeMember({ params: { orgId: ORG_ID, userId: TARGET_ID } });

        const after = yield* client.organization.findMembers({ params: { orgId: ORG_ID } });
        const stillMember = after.members.some((m) => m.userId === TARGET_ID);
        deepStrictEqual(stillMember, false);
      }),
    );

    it.effect("returns 404 when the target is not a member of the org", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.removeMember({ params: { orgId: ORG_ID, userId: TARGET_ID } }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag,
            "MembershipNotFoundError",
          );
        }
      }),
    );

    it.effect("returns 404 when the organization does not exist", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.removeMember({
            params: { orgId: UNKNOWN_ORG_ID, userId: TARGET_ID },
          }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag,
            "OrganizationNotFoundError",
          );
        }
      }),
    );
  },
);

describeServer(
  "DELETE /orgs/:orgId/members/:userId (integration, non-admin member caller)",
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
    it.effect("forbids a member who is not an org admin from removing members", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedTargetMembership;
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.removeMember({ params: { orgId: ORG_ID, userId: TARGET_ID } }),
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
