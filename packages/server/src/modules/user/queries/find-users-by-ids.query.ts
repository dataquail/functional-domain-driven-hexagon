import * as Schema from "effect/Schema";

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
