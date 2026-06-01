import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import {
  type FindMyOrganizationsOutput,
  type FindMyOrganizationsQuery,
  type FindMyOrganizationsView,
} from "@/modules/organization/queries/find-my-organizations-query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const toView = (row: RowSchemas.OrganizationRow): FindMyOrganizationsView => ({
  id: OrganizationId.make(row.id),
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Both tables live in the `organization` schema, so the join is
// intra-schema (allowed by ADR-0021's `no-cross-schema-slonik-access`
// rule). Tombstoned orgs are filtered out — a soft-deleted org should
// not appear in the caller's chooser.
export const findMyOrganizations = (query: FindMyOrganizationsQuery): FindMyOrganizationsOutput =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const rows = yield* db
      .execute((client) =>
        client.any(sql.type(RowSchemas.OrganizationRowStd)`
          SELECT o.*
          FROM "organization".memberships m
          JOIN "organization".organizations o ON o.id = m.organization_id
          WHERE m.user_id = ${query.userId}
            AND o.deleted_at IS NULL
          ORDER BY o.created_at DESC
        `),
      )
      .pipe(
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.catchTag("DatabaseUnavailable", (e) =>
          Effect.fail(new PersistenceUnavailable({ message: e.message })),
        ),
      );

    return { organizations: rows.map(toView) };
  });
