import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.js";
import { type FindUsersUserView } from "@/modules/user/queries/find-users.query.js";
import { type FindUsersByIdsPayload } from "@/modules/user/queries/find-users-by-ids.query.js";

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

export const findUsersByIdsHandler = Effect.fn("findUsersByIdsHandler")(function* (
  query: FindUsersByIdsPayload,
) {
  if (query.ids.length === 0) return [];
  const sql = yield* Database.Database;

  const rows = yield* sql`
    SELECT * FROM "user".users
    WHERE id = ANY(${Database.uuidArray(query.ids)}::uuid[])
    ORDER BY created_at ASC
  `.pipe(Database.rows(RowSchemas.UserRow), translateDatabaseErrors);

  return rows.map(toUserView);
});
