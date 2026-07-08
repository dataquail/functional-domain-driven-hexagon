import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { OrganizationRootOps } from "@/modules/organization/domain/organization.root.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles.root.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { findUserOrganizationRoles } from "@/modules/organization/queries/find-user-organization-roles.handler.js";
import { FindUserOrganizationRolesQuery } from "@/modules/organization/queries/find-user-organization-roles.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const TestLayer = Layer.mergeAll(OrganizationRolesRepositoryLive, OrganizationRepositoryLive).pipe(
  Layer.provideMerge(TestDatabaseLive),
);

const seedUsers = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'member@example.com', 'USA', '1 St', '12345', now(), now()),
               (${issuedBy}, 'issuer@example.com', 'USA', '2 St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const seedOrg = Effect.gen(function* () {
  const orgs = yield* OrganizationRepository;
  yield* orgs.insertOne(OrganizationRootOps.create({ id: orgId, name: "Acme", now }).organization);
});

const suite = describe.sequential;

suite("findUserOrganizationRoles (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.organization_roles", "organization.organizations", "user.users").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  it.effect("returns an empty roles array for a (user, org) with none granted", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      yield* seedOrg;
      const result = yield* findUserOrganizationRoles(
        FindUserOrganizationRolesQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual(result.userId, userId);
      deepStrictEqual(result.organizationId, orgId);
      deepStrictEqual([...result.roles], []);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns the granted roles, projected to bare role names", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      yield* seedOrg;
      const repo = yield* OrganizationRolesRepository;
      const granted = OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, orgId),
        "admin",
        issuedBy,
      );
      if (Result.isFailure(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.success.organizationRoles);
      const result = yield* findUserOrganizationRoles(
        FindUserOrganizationRolesQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual([...result.roles], ["admin"]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
