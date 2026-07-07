import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type FindUsersUserView } from "@/modules/user/queries/find-users.query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Batched lookup by id list. Used by the SA's "members of an org"
// endpoint to enrich the org-module's membership rows with email
// without a cross-schema JOIN. Returns only the users present in the
// `ids` argument — missing ids are silently omitted.
export const FindUsersByIdsQuery = Schema.TaggedStruct("FindUsersByIdsQuery", {
  ids: Schema.Array(UserId),
});
export type FindUsersByIdsQuery = typeof FindUsersByIdsQuery.Type;

export const findUsersByIdsQuerySpanAttributes: SpanAttributesExtractor<FindUsersByIdsQuery> = (
  query,
) => ({ "query.id.count": query.ids.length });

export type FindUsersByIdsOutput = Effect.Effect<
  ReadonlyArray<FindUsersUserView>,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires `interface`
  interface QueryRegistry {
    FindUsersByIdsQuery: {
      readonly query: FindUsersByIdsQuery;
      readonly output: FindUsersByIdsOutput;
    };
  }
}
