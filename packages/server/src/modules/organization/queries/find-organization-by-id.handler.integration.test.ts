import { assertNone, assertSome } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { findOrganizationByIdHandler } from "@/modules/organization/queries/find-organization-by-id.handler";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const activeOrgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const deletedOrgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const unknownOrgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");

const seedOrganizations = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES
          (${activeOrgId}, 'Active', now(), now(), null),
          (${deletedOrgId}, 'Tombstoned', now(), now(), now())
      `.pipe(Effect.orDie);
});

describeIntegration(
  "findOrganizationByIdHandler (integration)",
  { layer: TestDatabaseLive, tables: ["organization.organizations"] },
  (it) => {
    it.effect("returns the view for an active organization", () =>
      Effect.gen(function* () {
        yield* seedOrganizations;
        const view = yield* findOrganizationByIdHandler({ organizationId: activeOrgId });
        assertSome(view, { organizationId: activeOrgId });
      }),
    );

    // The restore endpoint has to resolve a tombstoned org to decide whether the
    // caller may act on it, so soft-deleted rows must NOT read as absent.
    it.effect("returns the view for a soft-deleted organization", () =>
      Effect.gen(function* () {
        yield* seedOrganizations;
        const view = yield* findOrganizationByIdHandler({ organizationId: deletedOrgId });
        assertSome(view, { organizationId: deletedOrgId });
      }),
    );

    it.effect("returns None for an unknown organization", () =>
      Effect.gen(function* () {
        yield* seedOrganizations;
        const view = yield* findOrganizationByIdHandler({ organizationId: unknownOrgId });
        assertNone(view);
      }),
    );
  },
);
