import {
  type FindUsersOutput,
  type FindUsersQuery,
} from "@/modules/user/application/queries/find-users-query.js";
import { UserId } from "@/modules/user/domain/user-id.js";
import { UserContract } from "@org/contracts/api/Contracts";
import { Database, RowSchemas, sql } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const CountRowStd = Schema.standardSchemaV1(Schema.Struct({ value: Schema.Number }));

const toUserView = (row: RowSchemas.UserRow): UserContract.User =>
  new UserContract.User({
    id: UserId.make(row.id),
    email: row.email,
    role: row.role as UserContract.UserRole,
    address: {
      country: row.country,
      street: row.street,
      postalCode: row.postal_code,
    },
    createdAt: DateTime.unsafeMake(row.created_at),
    updatedAt: DateTime.unsafeMake(row.updated_at),
  });

export const findUsers = (query: FindUsersQuery): FindUsersOutput =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const offset = (query.page - 1) * query.pageSize;

    const result = yield* db
      .execute((client) =>
        Promise.all([
          client.any(sql.type(RowSchemas.UserRowStd)`
            SELECT * FROM users
            ORDER BY created_at DESC
            LIMIT ${query.pageSize} OFFSET ${offset}
          `),
          client.one(sql.type(CountRowStd)`
            SELECT COUNT(*)::int AS value FROM users
          `),
        ]),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));

    const [rows, countRow] = result;

    return new UserContract.PaginatedUsers({
      users: rows.map(toUserView),
      page: query.page,
      pageSize: query.pageSize,
      total: countRow.value,
    });
  });
