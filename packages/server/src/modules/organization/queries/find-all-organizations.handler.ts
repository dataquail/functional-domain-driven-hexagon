import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindAllOrganizationsPayload,
  type FindAllOrganizationsView,
} from "@/modules/organization/queries/find-all-organizations.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const CountRow = Schema.Struct({ value: Schema.Number });

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
export const findAllOrganizationsHandler = Effect.fn("findAllOrganizationsHandler")(function* (
  query: FindAllOrganizationsPayload,
) {
  const sql = yield* Database.Database;
  const offset = (query.page - 1) * query.pageSize;

  // Sequential, not concurrent: inside a unit of work both statements share the
  // ambient transaction connection, which cannot serve two queries at once.
  const [rows, countRow] = yield* Effect.all([
    query.includeDeleted
      ? sql`
          SELECT * FROM "organization".organizations
          ORDER BY created_at DESC
          LIMIT ${query.pageSize} OFFSET ${offset}
        `.pipe(Database.rows(RowSchemas.OrganizationRow))
      : sql`
          SELECT * FROM "organization".organizations
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT ${query.pageSize} OFFSET ${offset}
        `.pipe(Database.rows(RowSchemas.OrganizationRow)),
    query.includeDeleted
      ? sql`
          SELECT COUNT(*)::int AS value FROM "organization".organizations
        `.pipe(Database.row(CountRow))
      : sql`
          SELECT COUNT(*)::int AS value FROM "organization".organizations
          WHERE deleted_at IS NULL
        `.pipe(Database.row(CountRow)),
  ]).pipe(translateDatabaseErrors);

  return {
    organizations: rows.map(toView),
    page: query.page,
    pageSize: query.pageSize,
    total: countRow.value,
  };
});
