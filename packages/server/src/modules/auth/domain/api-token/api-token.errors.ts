import * as Schema from "effect/Schema";

// Fieldless: raised both by `findOneById` (revoke path — the caller already
// holds the id from the request) and by `findOneByHash` (per-request lookup,
// where a miss has no id to report). Keeping it fieldless lets one error
// serve both without an awkward optional id.
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
