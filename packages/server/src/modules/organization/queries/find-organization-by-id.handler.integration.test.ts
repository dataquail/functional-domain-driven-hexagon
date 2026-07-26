import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import { beforeEach } from "vitest";

import { findOrganizationById } from "@/modules/organization/queries/find-organization-by-id.handler.js";
import { FindOrganizationByIdQuery } from "@/modules/organization/queries/find-organization-by-id.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const activeOrgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const deletedOrgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const unknownOrgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");

const seedOrganizations = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES
          (${activeOrgId}, 'Active', now(), now(), null),
          (${deletedOrgId}, 'Tombstoned', now(), now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const suite = describe.sequential;

suite("findOrganizationById (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.organizations").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it("returns the view for an active organization", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrganizations;
        const view = yield* findOrganizationById(
          FindOrganizationByIdQuery.make({ organizationId: activeOrgId }),
        );
        deepStrictEqual(view, { organizationId: activeOrgId });
      }).pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  // The restore endpoint has to resolve a tombstoned org to decide whether the
  // caller may act on it, so soft-deleted rows must NOT read as absent.
  it("returns the view for a soft-deleted organization", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrganizations;
        const view = yield* findOrganizationById(
          FindOrganizationByIdQuery.make({ organizationId: deletedOrgId }),
        );
        deepStrictEqual(view, { organizationId: deletedOrgId });
      }).pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it("returns null for an unknown organization", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrganizations;
        const view = yield* findOrganizationById(
          FindOrganizationByIdQuery.make({ organizationId: unknownOrgId }),
        );
        deepStrictEqual(view, null);
      }).pipe(Effect.provide(TestDatabaseLive)),
    );
  });
});
