import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { beforeEach } from "vitest";

import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles.root.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

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

  describe("findOneByUserIdAndOrgId", () => {
    it.effect("returns an empty aggregate when no rows exist", () =>
      Effect.gen(function* () {
        yield* seedFixtures;
        const repo = yield* OrganizationRolesRepository;
        const roles = yield* repo.findOneByUserIdAndOrgId(userId, orgId);
        deepStrictEqual(roles.userId, userId);
        deepStrictEqual(roles.organizationId, orgId);
        deepStrictEqual([...roles.roles], []);
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
        const fetched = yield* repo.findOneByUserIdAndOrgId(userId, orgId);
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
        const fetched = yield* repo.findOneByUserIdAndOrgId(userId, orgId);
        deepStrictEqual([...fetched.roles], []);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
