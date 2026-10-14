import { deepStrictEqual } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { Spec } from "@/globals/application/ddd/specification.ts";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.ts";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.ts";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.ts";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

const forPair = Spec.and(
  OrganizationRolesSpecifications.forUser(userId),
  OrganizationRolesSpecifications.forOrganization(orgId),
);

// organization.organization_roles FKs to "user".users(id) (twice — for
// user_id + issued_by) and organization.organizations(id). Each test
// seeds the FK rows via raw SQL since the org module's barrel doesn't
// (and shouldn't) re-export the user module's repository internals.
const seedFixtures = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now())
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${issuedBy}, 'admin@example.com', 'USA', '1 Admin Way', '12345', now(), now())
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${orgId}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
});

const TestLayer = OrganizationRolesRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "OrganizationRolesRepositoryLive (integration)",
  {
    layer: TestLayer,
    tables: ["organization.organization_roles", "organization.organizations", "user.users"],
  },
  (it) => {
    describe("findOne", () => {
      it.effect("returns null when no rows exist (the empty case is the caller's)", () =>
        Effect.gen(function* () {
          yield* seedFixtures;
          const repo = yield* OrganizationRolesRepository;
          const roles = yield* repo.findOne(forPair);
          assertNone(roles);
        }),
      );
    });

    describe("save", () => {
      it.effect("persists granted roles with the issuedBy audit and round-trips", () =>
        Effect.gen(function* () {
          yield* seedFixtures;
          const repo = yield* OrganizationRolesRepository;

          const granted = Result.getOrThrow(
            OrganizationRolesRootOps.grantRole(
              OrganizationRolesRootOps.empty(userId, orgId),
              "admin",
              issuedBy,
            ),
          );

          yield* repo.upsertOne(granted.organizationRoles);
          const maybeFetched = yield* repo.findOne(forPair);

          const fetched = Option.getOrThrow(maybeFetched);
          deepStrictEqual(
            fetched.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
            [{ role: "admin", issuedBy }],
          );
        }),
      );

      it.effect("replaces existing rows when an aggregate revokes a role", () =>
        Effect.gen(function* () {
          yield* seedFixtures;
          const repo = yield* OrganizationRolesRepository;

          const granted = Result.getOrThrow(
            OrganizationRolesRootOps.grantRole(
              OrganizationRolesRootOps.empty(userId, orgId),
              "admin",
              issuedBy,
            ),
          );

          yield* repo.upsertOne(granted.organizationRoles);

          const revoked = Result.getOrThrow(
            OrganizationRolesRootOps.revokeRole(granted.organizationRoles, "admin"),
          );

          yield* repo.upsertOne(revoked.organizationRoles);
          // Revoking the last role deletes every row, so there is nothing to
          // reconstitute — findOne reports null (no rows = no roles).
          const fetched = yield* repo.findOne(forPair);
          assertNone(fetched);
        }),
      );
    });
  },
);
