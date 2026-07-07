import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import { type FindUsersUserView } from "@/modules/user/queries/find-users.query.js";
import {
  type FindUsersByIdsOutput,
  type FindUsersByIdsQuery,
} from "@/modules/user/queries/find-users-by-ids.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

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

export const findUsersByIds = (query: FindUsersByIdsQuery): FindUsersByIdsOutput =>
  Effect.gen(function* () {
    if (query.ids.length === 0) return [];
    const db = yield* Database.Database;
    const rows = yield* db
      .execute((client) =>
        client.any(sql.type(RowSchemas.UserRowStd)`
          SELECT * FROM "user".users
          WHERE id = ANY(${sql.array(query.ids, "uuid")})
          ORDER BY created_at ASC
        `),
      )
      .pipe(
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.catchTag("DatabaseUnavailable", (e) =>
          Effect.fail(new PersistenceUnavailable({ message: e.message })),
        ),
      );
    return rows.map(toUserView);
  });
