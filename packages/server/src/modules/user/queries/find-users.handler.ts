import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors";
import {
  type FindUsersPayload,
  type FindUsersUserView,
} from "@/modules/user/queries/find-users.query";

const CountRow = Schema.Struct({ value: Schema.Int });

const toUserView = (row: RowSchemas.UserRow): FindUsersUserView => ({
  id: UserId.make(row.id),
  email: row.email,
  address: Option.getOrNull(
    Option.all({
      country: Option.fromNullOr(row.country),
      street: Option.fromNullOr(row.street),
      postalCode: Option.fromNullOr(row.postal_code),
    }),
  ),
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
