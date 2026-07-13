import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.js";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));

const byPair = (u: UserId, o: OrganizationId) =>
  Spec.and(MembershipSpecifications.forUser(u), MembershipSpecifications.forOrganization(o));

// organization.memberships FKs to "user".users(id) and
// organization.organizations(id) — seed both via raw SQL since neither
// repository's barrel exposes its internals to a sibling integration test.
const seedFks = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now()),
               (${otherUserId}, 'bob@example.com', 'USA', '456 Main St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${organizationId}, 'Acme', now(), now(), NULL)
      `),
    )
    .pipe(Effect.orDie);
});

const TestLayer = MembershipRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = describe.sequential;

suite("MembershipRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.memberships", "organization.organizations", "user.users").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  describe("insert + findOne", () => {
    it.effect("round-trips an inserted membership", () =>
      Effect.gen(function* () {
        yield* seedFks;
        const repo = yield* MembershipRepository;
        const { membership } = MembershipRootOps.create({ userId, organizationId, now });
        yield* repo.insertOne(membership);
        const found = yield* repo.findOne(byPair(userId, organizationId));
        if (found === null) throw new Error("expected membership");
        deepStrictEqual(found.userId, userId);
        deepStrictEqual(found.organizationId, organizationId);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("insert is idempotent — second call with same PK doesn't fail", () =>
      Effect.gen(function* () {
        yield* seedFks;
        const repo = yield* MembershipRepository;
        const { membership } = MembershipRootOps.create({ userId, organizationId, now });
        yield* repo.insertOne(membership);
        yield* repo.insertOne(membership);
        const found = yield* repo.findOne(byPair(userId, organizationId));
        if (found === null) throw new Error("expected membership");
        deepStrictEqual(found.userId, userId);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("findOne returns null for an unknown pair", () =>
      Effect.gen(function* () {
        yield* seedFks;
        const repo = yield* MembershipRepository;
        const found = yield* repo.findOne(byPair(otherUserId, organizationId));
        deepStrictEqual(found, null);
      }).pipe(Effect.provide(TestLayer)),
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
        deepStrictEqual(found, null);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails MembershipNotFound when no row exists", () =>
      Effect.gen(function* () {
        yield* seedFks;
        const repo = yield* MembershipRepository;
        const exit = yield* Effect.exit(repo.deleteOne(userId, organizationId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause)
            ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
            : null;
          deepStrictEqual(error instanceof MembershipNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
