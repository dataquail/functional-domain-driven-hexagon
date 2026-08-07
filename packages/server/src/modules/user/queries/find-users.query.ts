import { PersistenceUnavailable, Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

export const FindUsersUserView = Schema.Struct({
  id: UserId,
  email: Schema.String,
  // Nullable: JIT-provisioned users have no address until they fill it in.
  address: Schema.NullOr(
    Schema.Struct({
      country: Schema.String,
      street: Schema.String,
      postalCode: Schema.String,
    }),
  ),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
});
export type FindUsersUserView = typeof FindUsersUserView.Type;

export const FindUsersResultView = Schema.Struct({
  users: Schema.Array(FindUsersUserView),
  page: Schema.Number,
  pageSize: Schema.Number,
  total: Schema.Number,
});
export type FindUsersResult = typeof FindUsersResultView.Type;

export const FindUsersQuery = Query.make("FindUsersQuery", {
  payload: { page: Schema.Number, pageSize: Schema.Number },
  success: FindUsersResultView,
  failure: PersistenceUnavailable,
});
export type FindUsersPayload = Query.Payload<typeof FindUsersQuery>;
