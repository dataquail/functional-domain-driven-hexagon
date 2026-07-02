import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Layer from "effect/Layer";

import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import * as OrganizationRoles from "@/modules/organization/domain/organization-roles.aggregate.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles-repository.js";
import { makeUsersLookupFake } from "@/modules/organization/infrastructure/external/users-lookup-fake.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/membership-repository-fake.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/organization-roles-repository-fake.js";
import { findOrganizationMemberships } from "@/modules/organization/queries/find-organization-memberships.js";
import { FindOrganizationMembershipsQuery } from "@/modules/organization/queries/find-organization-memberships-query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

const orgA = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const orgB = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userA = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const userB = UserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const userC = UserId.make("cccccccc-cccc-cccc-cccc-cccccccccccc");
const now = DateTime.unsafeFromDate(new Date("2026-01-01T00:00:00Z"));

const seed = (userId: UserId, organizationId: OrganizationId) =>
  Membership.create({ userId, organizationId, now }).membership;

const issuer = UserId.make("99999999-9999-9999-9999-999999999990");

const TestLayer = Layer.mergeAll(
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  makeUsersLookupFake(
    new Map([
      [userA, { userId: userA, email: "a@example.com" }],
      [userB, { userId: userB, email: "b@example.com" }],
      [userC, { userId: userC, email: "c@example.com" }],
    ]),
  ),
);

// Seed `userId` as an admin of `organizationId` via the aggregate +
// repository (the production grant path), so the fake round-trips the
// role the query reads back.
const seedAdmin = (userId: UserId, organizationId: OrganizationId) =>
  Effect.gen(function* () {
    const rolesRepo = yield* OrganizationRolesRepository;
    const granted = OrganizationRoles.grantRole(
      OrganizationRoles.empty(userId, organizationId),
      "admin",
      issuer,
    );
    if (Either.isRight(granted)) {
      yield* rolesRepo.upsertOne(granted.right.organizationRoles);
    }
  });

describe("findOrganizationMemberships", () => {
  it.effect("returns only the requested org's members, enriched with email", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      yield* repo.insertOne(seed(userA, orgA));
      yield* repo.insertOne(seed(userB, orgA));
      yield* repo.insertOne(seed(userC, orgB));

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
      const repo = yield* MembershipRepository;
      yield* repo.insertOne(seed(userA, orgA));
      yield* repo.insertOne(seed(userB, orgA));
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
      const result = yield* findOrganizationMemberships(
        FindOrganizationMembershipsQuery.make({ organizationId: orgA }),
      );
      deepStrictEqual(result, []);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("skips members whose user record is missing from the lookup", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      yield* repo.insertOne(seed(userA, orgA));
      const orphanedUser = UserId.make("99999999-9999-9999-9999-999999999999");
      yield* repo.insertOne(seed(orphanedUser, orgA));

      const result = yield* findOrganizationMemberships(
        FindOrganizationMembershipsQuery.make({ organizationId: orgA }),
      );
      deepStrictEqual(result.length, 1);
      deepStrictEqual(result[0]?.userId, userA);
    }).pipe(Effect.provide(TestLayer)),
  );
});
