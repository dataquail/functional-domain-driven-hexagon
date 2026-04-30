import { type UserRole } from "@/modules/user/domain/user-role.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import { type Database } from "@org/database/index";
import type * as DateTime from "effect/DateTime";
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

export type FindUsersUserView = {
  readonly id: UserId;
  readonly email: string;
  readonly role: UserRole;
  readonly address: {
    readonly country: string;
    readonly street: string;
    readonly postalCode: string;
  };
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
};

export type FindUsersResult = {
  readonly users: ReadonlyArray<FindUsersUserView>;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export type FindUsersOutput = Effect.Effect<FindUsersResult, never, Database.Database>;

declare module "@/platform/query-bus.js" {
  interface QueryRegistry {
    FindUsersQuery: {
      readonly query: FindUsersQuery;
      readonly output: FindUsersOutput;
    };
  }
}
