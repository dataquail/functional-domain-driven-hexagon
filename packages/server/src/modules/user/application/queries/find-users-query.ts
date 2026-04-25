import { type UserContract } from "@org/contracts/api/Contracts";
import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const FindUsersQuery = Schema.TaggedStruct("FindUsersQuery", {
  page: Schema.Number,
  pageSize: Schema.Number,
});
export type FindUsersQuery = typeof FindUsersQuery.Type;

export type FindUsersOutput = Effect.Effect<UserContract.PaginatedUsers, never, Database.Database>;

declare module "@/platform/query-bus.js" {
  interface QueryRegistry {
    FindUsersQuery: {
      readonly query: FindUsersQuery;
      readonly output: FindUsersOutput;
    };
  }
}
