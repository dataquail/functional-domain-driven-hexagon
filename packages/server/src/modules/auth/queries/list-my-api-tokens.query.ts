import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { type ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Lists the caller's active (non-revoked) tokens for the management UI.
export const ListMyApiTokensQuery = Schema.TaggedStruct("ListMyApiTokensQuery", {
  userId: UserId,
});
export type ListMyApiTokensQuery = typeof ListMyApiTokensQuery.Type;

// Secret-free projection: only the display `prefix` and metadata, never
// the `token_hash`.
export type ApiTokenView = {
  readonly id: ApiTokenId;
  readonly label: string;
  readonly prefix: string;
  readonly expiresAt: DateTime.Utc | null;
  readonly createdAt: DateTime.Utc;
  readonly lastUsedAt: DateTime.Utc;
};

export const listMyApiTokensQuerySpanAttributes: SpanAttributesExtractor<ListMyApiTokensQuery> = (
  q,
) => ({ "user.id": q.userId });
