import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership-errors.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipRepositoryFake } from "./membership-repository-fake.js";

const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherUserId = UserId.make("cccccccc-cccc-cccc-cccc-cccccccccccc");
const organizationId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const provide = Effect.provide(MembershipRepositoryFake);

describe("MembershipRepositoryFake", () => {
  it.effect("findByUserIdAndOrgId round-trips an inserted membership", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = Membership.create({ userId, organizationId, now });
      yield* repo.insert(membership);
      const found = yield* repo.findByUserIdAndOrgId(userId, organizationId);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.organizationId, organizationId);
    }).pipe(provide),
  );

  it.effect("insert is idempotent — a second insert for the same PK is a no-op", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = Membership.create({ userId, organizationId, now });
      yield* repo.insert(membership);
      yield* repo.insert(membership);
      const found = yield* repo.findByUserIdAndOrgId(userId, organizationId);
      deepStrictEqual(found.userId, userId);
    }).pipe(provide),
  );

  it.effect("findByUserIdAndOrgId fails MembershipNotFound when absent", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const exit = yield* Effect.exit(repo.findByUserIdAndOrgId(userId, organizationId));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof MembershipNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("delete removes the row; subsequent find fails MembershipNotFound", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = Membership.create({ userId, organizationId, now });
      yield* repo.insert(membership);
      yield* repo.delete(userId, organizationId);
      const exit = yield* Effect.exit(repo.findByUserIdAndOrgId(userId, organizationId));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );

  it.effect("delete fails MembershipNotFound when no row exists", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const exit = yield* Effect.exit(repo.delete(userId, organizationId));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof MembershipNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("only finds the (user, org) pair that was inserted, not a sibling", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = Membership.create({ userId, organizationId, now });
      yield* repo.insert(membership);
      const exit = yield* Effect.exit(repo.findByUserIdAndOrgId(otherUserId, organizationId));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );
});
