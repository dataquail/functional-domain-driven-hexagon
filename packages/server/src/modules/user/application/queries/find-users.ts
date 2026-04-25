import { UserId } from "@org/contracts/EntityIds";
import { UserContract } from "@org/contracts/api/Contracts";
import { Database, DbSchema } from "@org/database/index";
import { count } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const FindUsersQuery = Schema.TaggedStruct("FindUsersQuery", {
  page: Schema.Number,
  pageSize: Schema.Number,
});
export type FindUsersQuery = typeof FindUsersQuery.Type;

type UserRow = typeof DbSchema.usersTable.$inferSelect;

const toUserView = (row: UserRow): UserContract.User =>
  new UserContract.User({
    id: UserId.make(row.id),
    email: row.email,
    role: row.role as UserContract.UserRole,
    address: {
      country: row.country,
      street: row.street,
      postalCode: row.postalCode,
    },
    createdAt: DateTime.unsafeMake(row.createdAt),
    updatedAt: DateTime.unsafeMake(row.updatedAt),
  });

declare module "@/platform/query-bus.js" {
  interface QueryRegistry {
    FindUsersQuery: {
      readonly query: FindUsersQuery;
      readonly output: Effect.Effect<UserContract.PaginatedUsers, never, Database.Database>;
    };
  }
}

export const findUsers = (
  query: FindUsersQuery,
): Effect.Effect<UserContract.PaginatedUsers, never, Database.Database> =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const offset = (query.page - 1) * query.pageSize;

    const result = yield* db
      .execute((client) =>
        Promise.all([
          client.query.usersTable.findMany({
            limit: query.pageSize,
            offset,
            orderBy: (t, { desc }) => [desc(t.createdAt)],
          }),
          client.select({ value: count() }).from(DbSchema.usersTable),
        ]),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));

    const [rows, countRows] = result;
    const total = countRows[0]?.value ?? 0;

    return new UserContract.PaginatedUsers({
      users: rows.map(toUserView),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }).pipe(Effect.withSpan("findUsers"));
