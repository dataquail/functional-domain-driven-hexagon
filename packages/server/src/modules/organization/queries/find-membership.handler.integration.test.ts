import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { MembershipRootOps } from "@/modules/organization/domain/membership.root.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization.root.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { findMembership } from "@/modules/organization/queries/find-membership.handler.js";
import { FindMembershipQuery } from "@/modules/organization/queries/find-membership.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const TestLayer = Layer.mergeAll(MembershipRepositoryLive, OrganizationRepositoryLive).pipe(
  Layer.provideMerge(TestDatabaseLive),
);

const seedUser = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'member@example.com', 'USA', '123 Main St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const seedOrg = Effect.gen(function* () {
  const orgs = yield* OrganizationRepository;
  yield* orgs.insertOne(OrganizationRootOps.create({ id: orgId, name: "Acme", now }).organization);
});

const suite = describe.sequential;

suite("findMembership (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.memberships", "organization.organizations", "user.users").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  it.effect("returns isMember=false when no membership row exists", () =>
    Effect.gen(function* () {
      yield* seedUser;
      yield* seedOrg;
      const result = yield* findMembership(
        FindMembershipQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual(result.isMember, false);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns isMember=true once the membership exists", () =>
    Effect.gen(function* () {
      yield* seedUser;
      yield* seedOrg;
      const repo = yield* MembershipRepository;
      const { membership } = MembershipRootOps.create({ userId, organizationId: orgId, now });
      yield* repo.insertOne(membership);
      const result = yield* findMembership(
        FindMembershipQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual(result.isMember, true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
