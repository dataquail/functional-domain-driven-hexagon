import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindMyOrganizationsOutput,
  type FindMyOrganizationsQuery,
  type FindMyOrganizationsView,
} from "@/modules/organization/queries/find-my-organizations.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Org columns plus a computed `is_admin` flag — the `EXISTS` subquery
// below adds a column the standard `OrganizationRow` schema doesn't
// carry, so this query defines its own row shape.
const MyOrganizationRow = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  name: Schema.String,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
  deleted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  is_admin: Schema.Boolean,
});
const MyOrganizationRowStd = Schema.toStandardSchemaV1(MyOrganizationRow);

const toView = (row: typeof MyOrganizationRow.Type): FindMyOrganizationsView => ({
  id: OrganizationId.make(row.id),
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isAdmin: row.is_admin,
});

// All three tables live in the `organization` schema, so the joins/
// subquery are intra-schema (allowed by ADR-0021's
// `no-cross-schema-slonik-access` rule). Tombstoned orgs are filtered
// out — a soft-deleted org should not appear in the caller's chooser.
// `is_admin` is the caller's own `admin` OrganizationRole in each org.
export const findMyOrganizations = (query: FindMyOrganizationsQuery): FindMyOrganizationsOutput =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const rows = yield* db
      .execute((client) =>
        client.any(sql.type(MyOrganizationRowStd)`
          SELECT
            o.*,
            EXISTS (
              SELECT 1
              FROM "organization".organization_roles r
              WHERE r.organization_id = o.id
                AND r.user_id = ${query.userId}
                AND r.role = 'admin'
            ) AS is_admin
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
