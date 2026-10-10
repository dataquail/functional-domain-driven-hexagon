import * as Schema from "effect/Schema";

// Fieldless: raised by the revoke path (the caller already holds the id from
// the request) and by the per-request bearer lookup (where a miss has no id to
// report). Keeping it fieldless lets one error serve both without an awkward
// optional id.
export class ApiTokenNotFound extends Schema.TaggedError<ApiTokenNotFound>()(
  "ApiTokenNotFound",
  {},
) {}

export class ApiTokenExpired extends Schema.TaggedError<ApiTokenExpired>()("ApiTokenExpired", {}) {}

export class ApiTokenRevoked extends Schema.TaggedError<ApiTokenRevoked>()("ApiTokenRevoked", {}) {}
