import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.ts";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.ts";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.ts";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.ts";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.ts";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.ts";
import { findMembershipHandler } from "@/modules/organization/queries/find-membership.handler.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const TestLayer = Layer.mergeAll(MembershipRepositoryLive, OrganizationRepositoryLive).pipe(
  Layer.provideMerge(TestDatabaseLive),
);

const seedUser = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'member@example.com', 'USA', '123 Main St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

const seedOrg = Effect.gen(function* () {
  const orgs = yield* OrganizationRepository;
  yield* orgs.insertOne(OrganizationRootOps.create({ id: orgId, name: "Acme", now }).organization);
});

describeIntegration(
  "findMembershipHandler (integration)",
  {
    layer: TestLayer,
    tables: ["organization.memberships", "organization.organizations", "user.users"],
  },
  (it) => {
    it.effect("returns isMember=false when no membership row exists", () =>
      Effect.gen(function* () {
        yield* seedUser;
        yield* seedOrg;
        const result = yield* findMembershipHandler({ userId, organizationId: orgId });
        deepStrictEqual(result.isMember, false);
      }),
    );

    it.effect("returns isMember=true once the membership exists", () =>
      Effect.gen(function* () {
        yield* seedUser;
        yield* seedOrg;
        const repo = yield* MembershipRepository;
        const { membership } = MembershipRootOps.create({ userId, organizationId: orgId, now });
        yield* repo.insertOne(membership);
        const result = yield* findMembershipHandler({ userId, organizationId: orgId });
        deepStrictEqual(result.isMember, true);
      }),
    );
  },
);
