import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Lists the caller's active (non-revoked) tokens for the management UI.
export const ListMyApiTokensQuery = Schema.TaggedStruct("ListMyApiTokensQuery", {
  userId: UserId,
});
export type ListMyApiTokensQuery = typeof ListMyApiTokensQuery.Type;

export const listMyApiTokensQuerySpanAttributes: SpanAttributesExtractor<ListMyApiTokensQuery> = (
  q,
) => ({ "user.id": q.userId });
