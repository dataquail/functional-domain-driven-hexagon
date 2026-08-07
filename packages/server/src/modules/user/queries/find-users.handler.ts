import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindUsersPayload,
  type FindUsersUserView,
} from "@/modules/user/queries/find-users.query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const CountRowStd = Schema.toStandardSchemaV1(Schema.Struct({ value: Schema.Number }));

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
  const db = yield* Database.Database;
  const offset = (query.page - 1) * query.pageSize;

  const result = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        Promise.all([
          client.any(sql.type(RowSchemas.UserRowStd)`
            SELECT * FROM "user".users
            ORDER BY created_at DESC
            LIMIT ${query.pageSize} OFFSET ${offset}
          `),
          client.one(sql.type(CountRowStd)`
            SELECT COUNT(*)::int AS value FROM "user".users
          `),
        ]),
      ),
    )()
    .pipe(translateDatabaseErrors);

  const [rows, countRow] = result;

  return {
    users: rows.map(toUserView),
    page: query.page,
    pageSize: query.pageSize,
    total: countRow.value,
  };
});
