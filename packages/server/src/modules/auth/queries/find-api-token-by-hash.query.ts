import * as Schema from "effect/Schema";

import { type ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Per-request bearer lookup, dispatched by the auth middleware. The caller
// hashes the presented token before dispatch, so the raw secret never
// travels through the bus or a span. Validates lifecycle (revoked /
// expired) the same way `FindSessionQuery` does for cookies.
export const FindApiTokenByHashQuery = Schema.TaggedStruct("FindApiTokenByHashQuery", {
  tokenHash: Schema.String,
});
export type FindApiTokenByHashQuery = typeof FindApiTokenByHashQuery.Type;

// The read model the auth middleware needs: the token's id (opaque
// principal id for a bearer caller) and the owning user.
export type ApiTokenPrincipalView = {
  readonly id: ApiTokenId;
  readonly userId: UserId;
};

// Read-side lifecycle outcomes — query-owned so the read path stays off
// the domain. Fieldless (a hash miss has no id to report); the auth
// middleware collapses all three to a 401.
export class ApiTokenNotFound extends Schema.TaggedErrorClass<ApiTokenNotFound>("ApiTokenNotFound")(
  "ApiTokenNotFound",
  {},
) {}

export class ApiTokenExpired extends Schema.TaggedErrorClass<ApiTokenExpired>("ApiTokenExpired")(
  "ApiTokenExpired",
  {},
) {}

export class ApiTokenRevoked extends Schema.TaggedErrorClass<ApiTokenRevoked>("ApiTokenRevoked")(
  "ApiTokenRevoked",
  {},
) {}

// Deliberately empty: `tokenHash` is secret-derived and must not land in a span.
export const findApiTokenByHashQuerySpanAttributes: SpanAttributesExtractor<
  FindApiTokenByHashQuery
> = () => ({});
