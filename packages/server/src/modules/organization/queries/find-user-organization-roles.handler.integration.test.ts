import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live";
import { findUserOrganizationRolesHandler } from "@/modules/organization/queries/find-user-organization-roles.handler";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const TestLayer = Layer.mergeAll(OrganizationRolesRepositoryLive, OrganizationRepositoryLive).pipe(
  Layer.provideMerge(TestDatabaseLive),
);

const seedUsers = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'member@example.com', 'USA', '1 St', '12345', now(), now()),
               (${issuedBy}, 'issuer@example.com', 'USA', '2 St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

const seedOrg = Effect.gen(function* () {
  const orgs = yield* OrganizationRepository;
  yield* orgs.insertOne(OrganizationRootOps.create({ id: orgId, name: "Acme", now }).organization);
});

describeIntegration(
  "findUserOrganizationRolesHandler (integration)",
  {
    layer: TestLayer,
    tables: ["organization.organization_roles", "organization.organizations", "user.users"],
  },
  (it) => {
    it.effect("returns an empty roles array for a (user, org) with none granted", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* seedOrg;
        const result = yield* findUserOrganizationRolesHandler({ userId, organizationId: orgId });
        deepStrictEqual(result.userId, userId);
        deepStrictEqual(result.organizationId, orgId);
        deepStrictEqual([...result.roles], []);
      }),
    );

    it.effect("returns the granted roles, projected to bare role names", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* seedOrg;
        const repo = yield* OrganizationRolesRepository;

        const granted = Result.getOrThrow(
          OrganizationRolesRootOps.grantRole(
            OrganizationRolesRootOps.empty(userId, orgId),
            "admin",
            issuedBy,
          ),
        );

        yield* repo.upsertOne(granted.organizationRoles);
        const result = yield* findUserOrganizationRolesHandler({ userId, organizationId: orgId });
        deepStrictEqual([...result.roles], ["admin"]);
      }),
    );
  },
);
