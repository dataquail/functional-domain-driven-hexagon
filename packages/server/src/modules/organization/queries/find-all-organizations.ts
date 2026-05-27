import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindAllOrganizationsOutput,
  type FindAllOrganizationsQuery,
  type FindAllOrganizationsView,
} from "@/modules/organization/queries/find-all-organizations-query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const CountRowStd = Schema.standardSchemaV1(Schema.Struct({ value: Schema.Number }));

const toView = (row: RowSchemas.OrganizationRow): FindAllOrganizationsView => ({
  id: OrganizationId.make(row.id),
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

// `includeDeleted` toggles the tombstone filter. Slonik's tag template
// doesn't compose well with conditional WHERE clauses so the two
// branches are parallel; the query is small enough that duplication
// reads better than abstracting.
export const findAllOrganizations = (
  query: FindAllOrganizationsQuery,
): FindAllOrganizationsOutput =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const offset = (query.page - 1) * query.pageSize;

    const result = yield* db
      .execute((client) =>
        Promise.all([
          query.includeDeleted
            ? client.any(sql.type(RowSchemas.OrganizationRowStd)`
                SELECT * FROM "organization".organizations
                ORDER BY created_at DESC
                LIMIT ${query.pageSize} OFFSET ${offset}
              `)
            : client.any(sql.type(RowSchemas.OrganizationRowStd)`
                SELECT * FROM "organization".organizations
                WHERE deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT ${query.pageSize} OFFSET ${offset}
              `),
          query.includeDeleted
            ? client.one(sql.type(CountRowStd)`
                SELECT COUNT(*)::int AS value FROM "organization".organizations
              `)
            : client.one(sql.type(CountRowStd)`
                SELECT COUNT(*)::int AS value FROM "organization".organizations
                WHERE deleted_at IS NULL
              `),
        ]),
      )
      .pipe(
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.catchTag("DatabaseUnavailable", (e) =>
          Effect.fail(new PersistenceUnavailable({ message: e.message })),
        ),
      );

    const [rows, countRow] = result;

    return {
      organizations: rows.map(toView),
      page: query.page,
      pageSize: query.pageSize,
      total: countRow.value,
    };
  });
