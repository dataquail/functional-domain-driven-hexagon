import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.ts";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.ts";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.ts";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.ts";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.ts";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.ts";
import { type UserLookupView } from "@/modules/organization/domain/ports/acl/users-lookup.acl.ts";
import { makeUsersLookupFake } from "@/modules/organization/infrastructure/acl/users-lookup.acl-fake.ts";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.ts";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.ts";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.ts";
import { findOrganizationMembershipsHandler } from "@/modules/organization/queries/find-organization-memberships.handler.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const orgA = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const orgB = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userA = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const userB = UserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const userC = UserId.make("cccccccc-cccc-cccc-cccc-cccccccccccc");
const orphanedUser = UserId.make("99999999-9999-9999-9999-999999999999");
const issuer = UserId.make("99999999-9999-9999-9999-999999999990");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");

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
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES
          (${userA}, 'a@example.com', 'USA', '1 St', '12345', now(), now()),
          (${userB}, 'b@example.com', 'USA', '2 St', '12345', now(), now()),
          (${userC}, 'c@example.com', 'USA', '3 St', '12345', now(), now()),
          (${orphanedUser}, 'orphan@example.com', 'USA', '4 St', '12345', now(), now()),
          (${issuer}, 'issuer@example.com', 'USA', '5 St', '12345', now(), now())
      `.pipe(Effect.orDie);
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

    const granted = Result.getOrThrow(
      OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, organizationId),
        "admin",
        issuer,
      ),
    );

    yield* rolesRepo.upsertOne(granted.organizationRoles);
  });

describeIntegration(
  "findOrganizationMembershipsHandler (integration)",
  {
    layer: TestLayer,
    tables: [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "user.users",
    ],
  },
  (it) => {
    it.effect("returns only the requested org's members, enriched with email", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* seedOrgs;
        yield* seedMember(userA, orgA);
        yield* seedMember(userB, orgA);
        yield* seedMember(userC, orgB);

        const result = yield* findOrganizationMembershipsHandler({ organizationId: orgA });
        deepStrictEqual(result.length, 2);
        deepStrictEqual(
          new Set(result.map((r) => r.email)),
          new Set(["a@example.com", "b@example.com"]),
        );
      }),
    );

    it.effect("flags admins via isAdmin and leaves plain members false", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* seedOrgs;
        yield* seedMember(userA, orgA);
        yield* seedMember(userB, orgA);
        yield* seedAdmin(userA, orgA);

        const result = yield* findOrganizationMembershipsHandler({ organizationId: orgA });
        const byUser = new Map(result.map((r) => [r.userId, r.isAdmin]));
        deepStrictEqual(byUser.get(userA), true);
        deepStrictEqual(byUser.get(userB), false);
      }),
    );

    it.effect("returns empty when the org has no members", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* seedOrgs;
        const result = yield* findOrganizationMembershipsHandler({ organizationId: orgA });
        deepStrictEqual(result, []);
      }),
    );

    it.effect("skips members whose user record is missing from the lookup", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* seedOrgs;
        yield* seedMember(userA, orgA);
        // `orphanedUser` has a membership row but is absent from the lookup map.
        yield* seedMember(orphanedUser, orgA);

        const result = yield* findOrganizationMembershipsHandler({ organizationId: orgA });
        deepStrictEqual(result.length, 1);
        deepStrictEqual(
          result.map((r) => r.userId),
          [userA],
        );
      }),
    );
  },
);
