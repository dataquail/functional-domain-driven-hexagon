import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { Spec } from "@/globals/application/ddd/specification.ts";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.ts";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.ts";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.ts";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.ts";

import { MembershipRepositoryFake } from "./membership.repository-fake.ts";

const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherUserId = UserId.make("cccccccc-cccc-cccc-cccc-cccccccccccc");
const organizationId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const provide = Effect.provide(MembershipRepositoryFake);

const byPair = (u: UserId, o: OrganizationId) =>
  Spec.and(MembershipSpecifications.forUser(u), MembershipSpecifications.forOrganization(o));

describe("MembershipRepositoryFake", () => {
  it.effect("findOne by pair spec round-trips an inserted membership", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = MembershipRootOps.create({ userId, organizationId, now });
      yield* repo.insertOne(membership);
      const maybeFound = yield* repo.findOne(byPair(userId, organizationId));
      const found = Option.getOrThrow(maybeFound);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.organizationId, organizationId);
    }).pipe(provide),
  );

  it.effect("insert is idempotent — a second insert for the same PK is a no-op", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = MembershipRootOps.create({ userId, organizationId, now });
      yield* repo.insertOne(membership);
      yield* repo.insertOne(membership);
      const maybeFound = yield* repo.findOne(byPair(userId, organizationId));
      const found = Option.getOrThrow(maybeFound);
      deepStrictEqual(found.userId, userId);
    }).pipe(provide),
  );

  it.effect("findOne returns null when absent", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const found = yield* repo.findOne(byPair(userId, organizationId));
      assertNone(found);
    }).pipe(provide),
  );

  it.effect("delete removes the row; subsequent find returns null", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = MembershipRootOps.create({ userId, organizationId, now });
      yield* repo.insertOne(membership);
      yield* repo.deleteOne(userId, organizationId);
      const found = yield* repo.findOne(byPair(userId, organizationId));
      assertNone(found);
    }).pipe(provide),
  );

  it.effect("delete fails MembershipNotFound when no row exists", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const error = yield* Effect.flip(repo.deleteOne(userId, organizationId));
      deepStrictEqual(Schema.is(MembershipNotFound)(error), true);
    }).pipe(provide),
  );

  it.effect("only finds the (user, org) pair that was inserted, not a sibling", () =>
    Effect.gen(function* () {
      const repo = yield* MembershipRepository;
      const { membership } = MembershipRootOps.create({ userId, organizationId, now });
      yield* repo.insertOne(membership);
      const found = yield* repo.findOne(byPair(otherUserId, organizationId));
      assertNone(found);
    }).pipe(provide),
  );
});
