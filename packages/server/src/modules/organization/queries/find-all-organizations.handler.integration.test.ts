import { deepStrictEqual } from "node:assert";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live";
import { findAllOrganizationsHandler } from "@/modules/organization/queries/find-all-organizations.handler";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2026-02-01T00:00:00Z");

const TestLayer = OrganizationRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "findAllOrganizationsHandler (integration)",
  { layer: TestLayer, tables: ["organization.organizations"] },
  (it) => {
    it.effect("hides soft-deleted orgs by default", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        yield* repo.insertOne(
          OrganizationRootOps.create({ id: acmeId, name: "Acme", now }).organization,
        );

        const { organization: betaOrg } = OrganizationRootOps.create({
          id: beta,
          name: "Beta",
          now,
        });

        yield* repo.insertOne(betaOrg);
        const deleted = Result.getOrThrow(OrganizationRootOps.softDelete(betaOrg, { now: later }));
        yield* repo.updateOne(deleted.organization);

        const result = yield* findAllOrganizationsHandler({
          page: 1,
          pageSize: 10,
          includeDeleted: false,
        });

        deepStrictEqual(result.total, 1);
        deepStrictEqual(result.organizations[0]?.name, "Acme");
      }),
    );

    it.effect("returns tombstoned rows when includeDeleted is true", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        yield* repo.insertOne(
          OrganizationRootOps.create({ id: acmeId, name: "Acme", now }).organization,
        );

        const { organization: betaOrg } = OrganizationRootOps.create({
          id: beta,
          name: "Beta",
          now,
        });

        yield* repo.insertOne(betaOrg);
        const deleted = Result.getOrThrow(OrganizationRootOps.softDelete(betaOrg, { now: later }));
        yield* repo.updateOne(deleted.organization);

        const result = yield* findAllOrganizationsHandler({
          page: 1,
          pageSize: 10,
          includeDeleted: true,
        });

        deepStrictEqual(result.total, 2);
      }),
    );

    it.effect("returns empty + total=0 on an empty table", () =>
      Effect.gen(function* () {
        const result = yield* findAllOrganizationsHandler({
          page: 1,
          pageSize: 10,
          includeDeleted: false,
        });

        deepStrictEqual(result.total, 0);
        deepStrictEqual([...result.organizations], []);
      }),
    );
  },
);
