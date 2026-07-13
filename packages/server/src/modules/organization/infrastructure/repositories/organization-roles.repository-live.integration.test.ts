import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { beforeEach } from "vitest";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

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
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${issuedBy}, 'admin@example.com', 'USA', '1 Admin Way', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${orgId}, 'Acme', now(), now(), null)
      `),
    )
    .pipe(Effect.orDie);
});

const TestLayer = OrganizationRolesRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = describe.sequential;

suite("OrganizationRolesRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.organization_roles", "organization.organizations", "user.users").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  describe("findOne", () => {
    it.effect("returns null when no rows exist (the empty case is the caller's)", () =>
      Effect.gen(function* () {
        yield* seedFixtures;
        const repo = yield* OrganizationRolesRepository;
        const roles = yield* repo.findOne(forPair);
        deepStrictEqual(roles, null);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("save", () => {
    it.effect("persists granted roles with the issuedBy audit and round-trips", () =>
      Effect.gen(function* () {
        yield* seedFixtures;
        const repo = yield* OrganizationRolesRepository;
        const granted = OrganizationRolesRootOps.grantRole(
          OrganizationRolesRootOps.empty(userId, orgId),
          "admin",
          issuedBy,
        );
        if (Result.isFailure(granted)) throw new Error("expected Right");
        yield* repo.upsertOne(granted.success.organizationRoles);
        const fetched = yield* repo.findOne(forPair);
        if (fetched === null) throw new Error("expected aggregate");
        deepStrictEqual(
          fetched.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
          [{ role: "admin", issuedBy }],
        );
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("replaces existing rows when an aggregate revokes a role", () =>
      Effect.gen(function* () {
        yield* seedFixtures;
        const repo = yield* OrganizationRolesRepository;
        const granted = OrganizationRolesRootOps.grantRole(
          OrganizationRolesRootOps.empty(userId, orgId),
          "admin",
          issuedBy,
        );
        if (Result.isFailure(granted)) throw new Error("expected Right");
        yield* repo.upsertOne(granted.success.organizationRoles);
        const revoked = OrganizationRolesRootOps.revokeRole(
          granted.success.organizationRoles,
          "admin",
        );
        if (Result.isFailure(revoked)) throw new Error("expected Right");
        yield* repo.upsertOne(revoked.success.organizationRoles);
        // Revoking the last role deletes every row, so there is nothing to
        // reconstitute — findOne reports null (no rows = no roles).
        const fetched = yield* repo.findOne(forPair);
        deepStrictEqual(fetched, null);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
