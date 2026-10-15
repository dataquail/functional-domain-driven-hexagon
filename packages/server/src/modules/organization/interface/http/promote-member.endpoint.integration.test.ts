import { deepStrictEqual, ok } from "node:assert";

import { assertDefined } from "@effect/vitest/utils";
import { OrganizationContract } from "@org/contracts/api/Contracts";
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
import { SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const TARGET_ID = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const seedOrgWithTarget = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${TARGET_ID}, 'target@test.local', 'USA', '3 St', '00000', now(), now())
        ON CONFLICT (id) DO NOTHING
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "organization".memberships (user_id, organization_id, created_at)
        VALUES (${TARGET_ID}, ${ORG_ID}, now())
      `.pipe(Effect.orDie);
});

describeServer(
  "POST /orgs/:orgId/members/:userId/admin (integration, super-admin caller)",
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
    it.effect("promotes a plain member, reflected as isAdmin in the members list", () =>
      Effect.gen(function* () {
        yield* seedOrgWithTarget;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.promoteMember({ params: { orgId: ORG_ID, userId: TARGET_ID } });

        const after = yield* client.organization.findMembers({ params: { orgId: ORG_ID } });
        const target = after.members.find((m) => m.userId === TARGET_ID);
        assertDefined(target);
        deepStrictEqual(target.isAdmin, true);
      }),
    );

    it.effect("returns 409 OrganizationRoleConflictError when already an admin", () =>
      Effect.gen(function* () {
        yield* seedOrgWithTarget;
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.promoteMember({ params: { orgId: ORG_ID, userId: TARGET_ID } });

        const exit = yield* Effect.exit(
          client.organization.promoteMember({ params: { orgId: ORG_ID, userId: TARGET_ID } }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          const error = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
          ok(Schema.is(OrganizationContract.OrganizationRoleConflictError)(error));
          deepStrictEqual(error.reason, "already_admin");
        }
      }),
    );

    it.effect("returns 403 Forbidden when the actor targets themselves", () =>
      Effect.gen(function* () {
        // Seed the org so the resource resolves; the self-promotion guard
        // (CannotPromoteSelfInOrganization) then fires in the command.
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${ORG_ID}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.promoteMember({
            params: { orgId: ORG_ID, userId: SUPER_ADMIN_CALLER_ID },
          }),
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

describeServer(
  "POST /orgs/:orgId/members/:userId/admin (integration, org-admin caller)",
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
    it.effect("lets an org admin (the creator) promote another member", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        // The member caller creates the org and is auto-granted `admin`.
        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        // Seed a second member to promote (no single-caller HTTP path adds one).
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
              VALUES (${TARGET_ID}, 'target@test.local', 'USA', '3 St', '00000', now(), now())
              ON CONFLICT (id) DO NOTHING
            `.pipe(Effect.orDie);
        yield* sql`
              INSERT INTO "organization".memberships (user_id, organization_id, created_at)
              VALUES (${TARGET_ID}, ${orgId}, now())
            `.pipe(Effect.orDie);

        yield* client.organization.promoteMember({ params: { orgId, userId: TARGET_ID } });

        const after = yield* client.organization.findMembers({ params: { orgId } });
        const target = after.members.find((m) => m.userId === TARGET_ID);
        assertDefined(target);
        deepStrictEqual(target.isAdmin, true);
      }),
    );

    it.effect("returns 403 Forbidden when the caller is not an admin of the org", () =>
      Effect.gen(function* () {
        // Org seeded with the member caller holding no admin role.
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
              VALUES (${TARGET_ID}, 'target@test.local', 'USA', '3 St', '00000', now(), now())
              ON CONFLICT (id) DO NOTHING
            `.pipe(Effect.orDie);
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${ORG_ID}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.promoteMember({ params: { orgId: ORG_ID, userId: TARGET_ID } }),
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
