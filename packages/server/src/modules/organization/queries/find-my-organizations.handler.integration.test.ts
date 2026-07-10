import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { MembershipRootOps } from "@/modules/organization/domain/membership.root-ops.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization.root-ops.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { findMyOrganizations } from "@/modules/organization/queries/find-my-organizations.handler.js";
import { FindMyOrganizationsQuery } from "@/modules/organization/queries/find-my-organizations.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const acmeId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const betaId = OrganizationId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));

const TestLayer = Layer.mergeAll(OrganizationRepositoryLive, MembershipRepositoryLive).pipe(
  Layer.provideMerge(TestDatabaseLive),
);

const seedUsers = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${aliceId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now()),
               (${bobId}, 'bob@example.com', 'USA', '456 Main St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const suite = describe.sequential;

suite("findMyOrganizations (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate(
        "organization.organization_roles",
        "organization.memberships",
        "organization.organizations",
        "user.users",
      ).pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("returns only orgs the caller is a member of", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      const orgs = yield* OrganizationRepository;
      const memberships = yield* MembershipRepository;
      yield* orgs.insertOne(
        OrganizationRootOps.create({ id: acmeId, name: "Acme", now }).organization,
      );
      yield* orgs.insertOne(
        OrganizationRootOps.create({ id: betaId, name: "Beta", now }).organization,
      );
      yield* memberships.insertOne(
        MembershipRootOps.create({ userId: aliceId, organizationId: acmeId, now }).membership,
      );
      // Bob is a member of Beta, not Acme — must not leak into Alice's view.
      yield* memberships.insertOne(
        MembershipRootOps.create({ userId: bobId, organizationId: betaId, now }).membership,
      );

      const result = yield* findMyOrganizations(FindMyOrganizationsQuery.make({ userId: aliceId }));
      deepStrictEqual(
        result.organizations.map((o) => o.name),
        ["Acme"],
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("flags orgs where the caller holds the admin role", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      const orgs = yield* OrganizationRepository;
      const memberships = yield* MembershipRepository;
      yield* orgs.insertOne(
        OrganizationRootOps.create({ id: acmeId, name: "Acme", now }).organization,
      );
      yield* orgs.insertOne(
        OrganizationRootOps.create({ id: betaId, name: "Beta", now }).organization,
      );
      yield* memberships.insertOne(
        MembershipRootOps.create({ userId: aliceId, organizationId: acmeId, now }).membership,
      );
      yield* memberships.insertOne(
        MembershipRootOps.create({ userId: aliceId, organizationId: betaId, now }).membership,
      );
      // Alice holds the `admin` role in Acme only.
      const db = yield* Database.Database;
      yield* db
        .execute((client) =>
          client.query(sql.unsafe`
            INSERT INTO "organization".organization_roles
              (organization_id, user_id, role, issued_by, created_at)
            VALUES (${acmeId}, ${aliceId}, 'admin', ${aliceId}, now())
          `),
        )
        .pipe(Effect.orDie);

      const result = yield* findMyOrganizations(FindMyOrganizationsQuery.make({ userId: aliceId }));
      const isAdminByName = new Map(result.organizations.map((o) => [o.name, o.isAdmin]));
      deepStrictEqual(isAdminByName.get("Acme"), true);
      deepStrictEqual(isAdminByName.get("Beta"), false);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns an empty list when the caller has no memberships", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      const result = yield* findMyOrganizations(FindMyOrganizationsQuery.make({ userId: aliceId }));
      deepStrictEqual([...result.organizations], []);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("hides soft-deleted orgs", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      const orgs = yield* OrganizationRepository;
      const memberships = yield* MembershipRepository;
      const { organization: acme } = OrganizationRootOps.create({ id: acmeId, name: "Acme", now });
      yield* orgs.insertOne(acme);
      yield* memberships.insertOne(
        MembershipRootOps.create({ userId: aliceId, organizationId: acmeId, now }).membership,
      );
      const deleted = OrganizationRootOps.softDelete(acme, { now });
      if (deleted._tag !== "Success") throw new Error("expected Right");
      yield* orgs.updateOne(deleted.success.organization);

      const result = yield* findMyOrganizations(FindMyOrganizationsQuery.make({ userId: aliceId }));
      deepStrictEqual([...result.organizations], []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
