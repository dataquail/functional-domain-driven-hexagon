import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UserId } from "@/platform/ids/user-id.js";

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
  // Nullable: JIT-provisioned users have no address until they fill it in.
  readonly address: {
    readonly country: string;
    readonly street: string;
    readonly postalCode: string;
  } | null;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
};

export type FindUsersResult = {
  readonly users: ReadonlyArray<FindUsersUserView>;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};
