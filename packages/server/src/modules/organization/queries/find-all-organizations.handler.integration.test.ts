import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { beforeEach } from "vitest";

import { OrganizationRootOps } from "@/modules/organization/domain/organization.root.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { findAllOrganizations } from "@/modules/organization/queries/find-all-organizations.handler.js";
import { FindAllOrganizationsQuery } from "@/modules/organization/queries/find-all-organizations.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const later = DateTime.makeUnsafe(new Date("2026-02-01T00:00:00Z"));

const TestLayer = OrganizationRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = describe.sequential;

suite("findAllOrganizations (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.organizations").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("hides soft-deleted orgs by default", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      yield* repo.insertOne(
        OrganizationRootOps.create({ id: acmeId, name: "Acme", now }).organization,
      );
      const { organization: betaOrg } = OrganizationRootOps.create({ id: beta, name: "Beta", now });
      yield* repo.insertOne(betaOrg);
      const deletedEither = OrganizationRootOps.softDelete(betaOrg, { now: later });
      if (Result.isFailure(deletedEither)) throw new Error("expected Right");
      yield* repo.updateOne(deletedEither.success.organization);

      const result = yield* findAllOrganizations(
        FindAllOrganizationsQuery.make({ page: 1, pageSize: 10, includeDeleted: false }),
      );
      deepStrictEqual(result.total, 1);
      deepStrictEqual(result.organizations[0]?.name, "Acme");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns tombstoned rows when includeDeleted is true", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      yield* repo.insertOne(
        OrganizationRootOps.create({ id: acmeId, name: "Acme", now }).organization,
      );
      const { organization: betaOrg } = OrganizationRootOps.create({ id: beta, name: "Beta", now });
      yield* repo.insertOne(betaOrg);
      const deletedEither = OrganizationRootOps.softDelete(betaOrg, { now: later });
      if (Result.isFailure(deletedEither)) throw new Error("expected Right");
      yield* repo.updateOne(deletedEither.success.organization);

      const result = yield* findAllOrganizations(
        FindAllOrganizationsQuery.make({ page: 1, pageSize: 10, includeDeleted: true }),
      );
      deepStrictEqual(result.total, 2);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns empty + total=0 on an empty table", () =>
    Effect.gen(function* () {
      const result = yield* findAllOrganizations(
        FindAllOrganizationsQuery.make({ page: 1, pageSize: 10, includeDeleted: false }),
      );
      deepStrictEqual(result.total, 0);
      deepStrictEqual([...result.organizations], []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
