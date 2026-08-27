import { Query } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { UserId } from "@/platform/ids/user-id.js";

// The read model the auth middleware needs: the token's id (opaque
// principal id for a bearer caller) and the owning user.
export const ApiTokenPrincipalView = Schema.Struct({
  id: ApiTokenId,
  userId: UserId,
});
export type ApiTokenPrincipalView = typeof ApiTokenPrincipalView.Type;

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

// Per-request bearer lookup, dispatched by the auth middleware. The caller
// hashes the presented token before dispatch, so the raw secret never
// travels through the bus or a span. Validates lifecycle (revoked /
// expired) the same way `FindSessionQuery` does for cookies.
export const FindApiTokenByHashQuery = Query.make("FindApiTokenByHashQuery", {
  payload: { tokenHash: Schema.String },
  success: ApiTokenPrincipalView,
  failure: Schema.Union([
    ApiTokenNotFound,
    ApiTokenExpired,
    ApiTokenRevoked,
    PersistenceUnavailable,
  ]),
});
export type FindApiTokenByHashPayload = Query.Payload<typeof FindApiTokenByHashQuery>;
