import { deepStrictEqual } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { Spec } from "@/globals/application/ddd/specification";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");

const byPair = (u: UserId, o: OrganizationId) =>
  Spec.and(MembershipSpecifications.forUser(u), MembershipSpecifications.forOrganization(o));

// organization.memberships FKs to "user".users(id) and
// organization.organizations(id) — seed both via raw SQL since neither
// repository's barrel exposes its internals to a sibling integration test.
const seedFks = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now()),
               (${otherUserId}, 'bob@example.com', 'USA', '456 Main St', '12345', now(), now())
      `.pipe(Effect.orDie);
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${organizationId}, 'Acme', now(), now(), NULL)
      `.pipe(Effect.orDie);
});

const TestLayer = MembershipRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "MembershipRepositoryLive (integration)",
  {
    layer: TestLayer,
    tables: ["organization.memberships", "organization.organizations", "user.users"],
  },
  (it) => {
    describe("insert + findOne", () => {
      it.effect("round-trips an inserted membership", () =>
        Effect.gen(function* () {
          yield* seedFks;
          const repo = yield* MembershipRepository;
          const { membership } = MembershipRootOps.create({ userId, organizationId, now });
          yield* repo.insertOne(membership);
          const maybeFound = yield* repo.findOne(byPair(userId, organizationId));

          const found = Option.getOrThrow(maybeFound);
          deepStrictEqual(found.userId, userId);
          deepStrictEqual(found.organizationId, organizationId);
        }),
      );

      it.effect("insert is idempotent — second call with same PK doesn't fail", () =>
        Effect.gen(function* () {
          yield* seedFks;
          const repo = yield* MembershipRepository;
          const { membership } = MembershipRootOps.create({ userId, organizationId, now });
          yield* repo.insertOne(membership);
          yield* repo.insertOne(membership);
          const maybeFound = yield* repo.findOne(byPair(userId, organizationId));

          const found = Option.getOrThrow(maybeFound);
          deepStrictEqual(found.userId, userId);
        }),
      );

      it.effect("findOne returns null for an unknown pair", () =>
        Effect.gen(function* () {
          yield* seedFks;
          const repo = yield* MembershipRepository;
          const found = yield* repo.findOne(byPair(otherUserId, organizationId));
          assertNone(found);
        }),
      );
    });

    describe("delete", () => {
      it.effect("removes the row; subsequent find returns null", () =>
        Effect.gen(function* () {
          yield* seedFks;
          const repo = yield* MembershipRepository;
          const { membership } = MembershipRootOps.create({ userId, organizationId, now });
          yield* repo.insertOne(membership);
          yield* repo.deleteOne(userId, organizationId);
          const found = yield* repo.findOne(byPair(userId, organizationId));
          assertNone(found);
        }),
      );

      it.effect("fails MembershipNotFound when no row exists", () =>
        Effect.gen(function* () {
          yield* seedFks;
          const repo = yield* MembershipRepository;
          const error = yield* Effect.flip(repo.deleteOne(userId, organizationId));
          deepStrictEqual(Schema.is(MembershipNotFound)(error), true);
        }),
      );
    });
  },
);
