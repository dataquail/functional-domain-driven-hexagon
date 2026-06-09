import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { makeUsersLookupFake } from "@/modules/organization/infrastructure/external/users-lookup-fake.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/membership-repository-fake.js";
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

const TestLayer = Layer.mergeAll(
  MembershipRepositoryFake,
  makeUsersLookupFake(
    new Map([
      [userA, { userId: userA, email: "a@example.com" }],
      [userB, { userId: userB, email: "b@example.com" }],
      [userC, { userId: userC, email: "c@example.com" }],
    ]),
  ),
);

describe("findOrganizationMemberships", () => {
  it.effect("returns only the requested org's members, enriched with email", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      yield* repo.insert(seed(userA, orgA));
      yield* repo.insert(seed(userB, orgA));
      yield* repo.insert(seed(userC, orgB));

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
      yield* repo.insert(seed(userA, orgA));
      const orphanedUser = UserId.make("99999999-9999-9999-9999-999999999999");
      yield* repo.insert(seed(orphanedUser, orgA));

      const result = yield* findOrganizationMemberships(
        FindOrganizationMembershipsQuery.make({ organizationId: orgA }),
      );
      deepStrictEqual(result.length, 1);
      deepStrictEqual(result[0]?.userId, userA);
    }).pipe(Effect.provide(TestLayer)),
  );
});
