import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { MembershipRootOps } from "@/modules/organization/domain/membership.root.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake.js";
import { findMembership } from "@/modules/organization/queries/find-membership.handler.js";
import { FindMembershipQuery } from "@/modules/organization/queries/find-membership.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

describe("findMembership", () => {
  it.effect("returns isMember=false when no membership row exists", () =>
    Effect.gen(function* () {
      const result = yield* findMembership(
        FindMembershipQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual(result.isMember, false);
    }).pipe(Effect.provide(MembershipRepositoryFake)),
  );

  it.effect("returns isMember=true once the membership exists", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = MembershipRootOps.create({ userId, organizationId: orgId, now });
      yield* repo.insertOne(membership);
      const result = yield* findMembership(
        FindMembershipQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual(result.isMember, true);
    }).pipe(Effect.provide(MembershipRepositoryFake)),
  );
});
