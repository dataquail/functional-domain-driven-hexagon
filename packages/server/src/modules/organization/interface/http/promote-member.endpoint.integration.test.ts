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

import { Api } from "@/api.js";
import { SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = describe.sequential;

const ORG_ID = "11111111-1111-1111-1111-111111111111" as never;
const TARGET_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" as never;

const seedOrgWithTarget = Effect.gen(function* () {
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
});

suite("POST /orgs/:orgId/members/:userId/admin (integration, super-admin caller)", () => {
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

  it("promotes a plain member, reflected as isAdmin in the members list", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrgWithTarget;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.promoteMember({ path: { orgId: ORG_ID, userId: TARGET_ID } });

        const after = yield* client.organization.findMembers({ path: { orgId: ORG_ID } });
        const target = after.members.find((m) => m.userId === TARGET_ID);
        ok(target !== undefined);
        deepStrictEqual(target.isAdmin, true);
      }),
    );
  });

  it("returns 409 OrganizationRoleConflictError when already an admin", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrgWithTarget;
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.promoteMember({ path: { orgId: ORG_ID, userId: TARGET_ID } });

        const exit = yield* Effect.exit(
          client.organization.promoteMember({ path: { orgId: ORG_ID, userId: TARGET_ID } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          const error = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
          ok(error instanceof OrganizationContract.OrganizationRoleConflictError);
          deepStrictEqual(error.reason, "already_admin");
        }
      }),
    );
  });

  it("returns 403 Forbidden when the actor targets themselves", async () => {
    await run(
      Effect.gen(function* () {
        // Seed the org so the resource resolves; the self-promotion guard
        // (CannotPromoteSelfInOrganization) then fires in the command.
        const db = yield* Database.Database;
        yield* db
          .execute((c) =>
            c.query(sql.unsafe`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${ORG_ID}, 'Acme', now(), now(), null)
            `),
          )
          .pipe(Effect.orDie);
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.promoteMember({
            path: { orgId: ORG_ID, userId: SUPER_ADMIN_CALLER_ID },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});

const orgAdminSuite = describe.sequential;

orgAdminSuite("POST /orgs/:orgId/members/:userId/admin (integration, org-admin caller)", () => {
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

  it("lets an org admin (the creator) promote another member", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        // The member caller creates the org and is auto-granted `admin`.
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        // Seed a second member to promote (no single-caller HTTP path adds one).
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
              INSERT INTO "organization".memberships (user_id, organization_id, created_at)
              VALUES (${TARGET_ID}, ${orgId}, now())
            `),
          )
          .pipe(Effect.orDie);

        yield* client.organization.promoteMember({ path: { orgId, userId: TARGET_ID } });

        const after = yield* client.organization.findMembers({ path: { orgId } });
        const target = after.members.find((m) => m.userId === TARGET_ID);
        ok(target !== undefined);
        deepStrictEqual(target.isAdmin, true);
      }),
    );
  });

  it("returns 403 Forbidden when the caller is not an admin of the org", async () => {
    await run(
      Effect.gen(function* () {
        // Org seeded with the member caller holding no admin role.
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
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.promoteMember({ path: { orgId: ORG_ID, userId: TARGET_ID } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
