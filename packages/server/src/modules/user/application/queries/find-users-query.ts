import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import { type UserContract } from "@org/contracts/api/Contracts";
import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const FindUsersQuery = Schema.TaggedStruct("FindUsersQuery", {
  page: Schema.Number,
  pageSize: Schema.Number,
});
export type FindUsersQuery = typeof FindUsersQuery.Type;

export const findUsersQuerySpanAttributes: SpanAttributesExtractor<FindUsersQuery> = (query) => ({
  "query.page": query.page,
  "query.pageSize": query.pageSize,
});

export type FindUsersOutput = Effect.Effect<UserContract.PaginatedUsers, never, Database.Database>;

declare module "@/platform/query-bus.js" {
  interface QueryRegistry {
    FindUsersQuery: {
      readonly query: FindUsersQuery;
      readonly output: FindUsersOutput;
    };
  }
}
