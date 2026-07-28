import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Secret-free projection: only the display `prefix` and metadata, never
// the `token_hash`.
export const ApiTokenView = Schema.Struct({
  id: ApiTokenId,
  label: Schema.String,
  prefix: Schema.String,
  expiresAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.DateTimeUtc,
});
export type ApiTokenView = typeof ApiTokenView.Type;

// Lists the caller's active (non-revoked) tokens for the management UI.
export const ListMyApiTokensQuery = Query.make("ListMyApiTokensQuery", {
  payload: { userId: UserId },
  success: Schema.Array(ApiTokenView),
  failure: PersistenceUnavailable,
});
export type ListMyApiTokensPayload = Query.Payload<typeof ListMyApiTokensQuery>;
