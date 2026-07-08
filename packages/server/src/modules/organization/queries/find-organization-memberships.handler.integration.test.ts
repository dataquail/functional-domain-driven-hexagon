import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { MembershipRootOps } from "@/modules/organization/domain/membership.root.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization.root.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles.root.js";
import { type UserLookupView } from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { makeUsersLookupFake } from "@/modules/organization/infrastructure/acl/users-lookup.acl-fake.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { findOrganizationMemberships } from "@/modules/organization/queries/find-organization-memberships.handler.js";
import { FindOrganizationMembershipsQuery } from "@/modules/organization/queries/find-organization-memberships.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const orgA = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const orgB = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userA = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const userB = UserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const userC = UserId.make("cccccccc-cccc-cccc-cccc-cccccccccccc");
const orphanedUser = UserId.make("99999999-9999-9999-9999-999999999999");
const issuer = UserId.make("99999999-9999-9999-9999-999999999990");
const now = DateTime.unsafeFromDate(new Date("2026-01-01T00:00:00Z"));

// The membership + roles reads hit the real DB. Email enrichment goes
// through the `UsersLookup` ACL — a deliberately swappable cross-module
// seam whose Live implementation dispatches through the full QueryBus, so
// the test wires the sanctioned in-memory fake seeded to match the rows.
const usersById = new Map<UserId, UserLookupView>([
  [userA, { userId: userA, email: "a@example.com" }],
  [userB, { userId: userB, email: "b@example.com" }],
  [userC, { userId: userC, email: "c@example.com" }],
]);

const TestLayer = Layer.mergeAll(
  MembershipRepositoryLive,
  OrganizationRolesRepositoryLive,
  OrganizationRepositoryLive,
  makeUsersLookupFake(usersById),
).pipe(Layer.provideMerge(TestDatabaseLive));

const seedUsers = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES
          (${userA}, 'a@example.com', 'USA', '1 St', '12345', now(), now()),
          (${userB}, 'b@example.com', 'USA', '2 St', '12345', now(), now()),
          (${userC}, 'c@example.com', 'USA', '3 St', '12345', now(), now()),
          (${orphanedUser}, 'orphan@example.com', 'USA', '4 St', '12345', now(), now()),
          (${issuer}, 'issuer@example.com', 'USA', '5 St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const seedOrgs = Effect.gen(function* () {
  const orgs = yield* OrganizationRepository;
  yield* orgs.insertOne(OrganizationRootOps.create({ id: orgA, name: "Acme", now }).organization);
  yield* orgs.insertOne(OrganizationRootOps.create({ id: orgB, name: "Beta", now }).organization);
});

const seedMember = (userId: UserId, organizationId: OrganizationId) =>
  Effect.gen(function* () {
    const repo = yield* MembershipRepository;
    yield* repo.insertOne(MembershipRootOps.create({ userId, organizationId, now }).membership);
  });

const seedAdmin = (userId: UserId, organizationId: OrganizationId) =>
  Effect.gen(function* () {
    const rolesRepo = yield* OrganizationRolesRepository;
    const granted = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, organizationId),
      "admin",
      issuer,
    );
    if (Either.isLeft(granted)) throw new Error("expected Right");
    yield* rolesRepo.upsertOne(granted.right.organizationRoles);
  });

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("findOrganizationMemberships (integration)", () => {
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

  it.effect("returns only the requested org's members, enriched with email", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      yield* seedOrgs;
      yield* seedMember(userA, orgA);
      yield* seedMember(userB, orgA);
      yield* seedMember(userC, orgB);

      const result = yield* findOrganizationMemberships(
        FindOrganizationMembershipsQuery.make({ organizationId: orgA }),
      );
      deepStrictEqual(result.length, 2);
      deepStrictEqual(
        new Set(result.map((r) => r.email)),
        new Set(["a@example.com", "b@example.com"]),
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("flags admins via isAdmin and leaves plain members false", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      yield* seedOrgs;
      yield* seedMember(userA, orgA);
      yield* seedMember(userB, orgA);
      yield* seedAdmin(userA, orgA);

      const result = yield* findOrganizationMemberships(
        FindOrganizationMembershipsQuery.make({ organizationId: orgA }),
      );
      const byUser = new Map(result.map((r) => [r.userId, r.isAdmin]));
      deepStrictEqual(byUser.get(userA), true);
      deepStrictEqual(byUser.get(userB), false);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns empty when the org has no members", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      yield* seedOrgs;
      const result = yield* findOrganizationMemberships(
        FindOrganizationMembershipsQuery.make({ organizationId: orgA }),
      );
      deepStrictEqual(result, []);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("skips members whose user record is missing from the lookup", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      yield* seedOrgs;
      yield* seedMember(userA, orgA);
      // `orphanedUser` has a membership row but is absent from the lookup map.
      yield* seedMember(orphanedUser, orgA);

      const result = yield* findOrganizationMemberships(
        FindOrganizationMembershipsQuery.make({ organizationId: orgA }),
      );
      deepStrictEqual(result.length, 1);
      deepStrictEqual(
        result.map((r) => r.userId),
        [userA],
      );
    }).pipe(Effect.provide(TestLayer)),
  );
});
