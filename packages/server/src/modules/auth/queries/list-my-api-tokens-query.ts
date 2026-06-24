import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type ApiToken } from "@/modules/auth/domain/api-token.aggregate.js";
import { type ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
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

// Raw handler effect — `ApiTokenRepository` is discharged by the wrap in
// `auth-query-handlers.ts`.
export type ListMyApiTokensOutput = Effect.Effect<
  ReadonlyArray<ApiToken>,
  PersistenceUnavailable,
  ApiTokenRepository
>;
