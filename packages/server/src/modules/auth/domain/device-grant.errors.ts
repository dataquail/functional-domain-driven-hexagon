import * as Schema from "effect/Schema";

// Unknown device_code / user_code, or a consumed (deleted) grant.
export class DeviceGrantNotFound extends Schema.TaggedError<DeviceGrantNotFound>(
  "DeviceGrantNotFound",
)("DeviceGrantNotFound", {}) {}

// The grant's short TTL has lapsed.
export class DeviceGrantExpired extends Schema.TaggedError<DeviceGrantExpired>(
  "DeviceGrantExpired",
)("DeviceGrantExpired", {}) {}

// Not yet approved in the browser — the CLI should keep polling. RFC 8628's
// `authorization_pending`.
export class DeviceGrantPending extends Schema.TaggedError<DeviceGrantPending>(
  "DeviceGrantPending",
)("DeviceGrantPending", {}) {}
