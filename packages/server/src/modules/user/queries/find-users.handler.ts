import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindUsersPayload,
  type FindUsersUserView,
} from "@/modules/user/queries/find-users.query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const CountRow = Schema.Struct({ value: Schema.Number });

const toUserView = (row: RowSchemas.UserRow): FindUsersUserView => ({
  id: UserId.make(row.id),
  email: row.email,
  address:
    row.country !== null && row.street !== null && row.postal_code !== null
      ? { country: row.country, street: row.street, postalCode: row.postal_code }
      : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const findUsersHandler = Effect.fn("findUsersHandler")(function* (query: FindUsersPayload) {
  const sql = yield* Database.Database;
  const offset = (query.page - 1) * query.pageSize;

  // Sequential, not concurrent: inside a unit of work both statements share the
  // ambient transaction connection, which cannot serve two queries at once.
  const [rows, countRow] = yield* Effect.all([
    sql`
      SELECT * FROM "user".users
      ORDER BY created_at DESC
      LIMIT ${query.pageSize} OFFSET ${offset}
    `.pipe(Database.rows(RowSchemas.UserRow)),
    sql`
      SELECT COUNT(*)::int AS value FROM "user".users
    `.pipe(Database.row(CountRow)),
  ]).pipe(translateDatabaseErrors);

  return {
    users: rows.map(toUserView),
    page: query.page,
    pageSize: query.pageSize,
    total: countRow.value,
  };
});
