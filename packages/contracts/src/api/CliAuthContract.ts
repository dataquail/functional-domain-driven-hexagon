import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import * as CustomHttpApiError from "../CustomHttpApiError.js";

// ==========================================
// Device authorization grant (RFC 8628), app-native — the CLI/MCP wire
// surface for sign-in. Public: the caller has no credential yet (ADR-0024).
// ==========================================

export class DeviceStartResponse extends Schema.Class<DeviceStartResponse>("DeviceStartResponse")({
  // Held by the CLI and presented on each poll. Secret.
  device_code: Schema.String,
  // Shown to the user to type into the browser (e.g. ABCD-2345).
  user_code: Schema.String,
  // Where to go to approve, and the same URL with the code pre-filled.
  verification_uri: Schema.String,
  verification_uri_complete: Schema.String,
  // Seconds the CLI should wait between polls, and until the codes lapse.
  interval: Schema.Number,
  expires_in: Schema.Number,
}) {}

export class DeviceTokenPayload extends Schema.Class<DeviceTokenPayload>("DeviceTokenPayload")({
  device_code: Schema.String,
}) {}

export class DeviceTokenResponse extends Schema.Class<DeviceTokenResponse>("DeviceTokenResponse")({
  access_token: Schema.String,
  token_type: Schema.Literal("Bearer"),
  expires_at: Schema.NullOr(Schema.DateTimeUtc),
}) {}

// RFC 8628 token-endpoint errors. All 400; the tag is the discriminator the
// CLI switches on (keep polling on pending; stop on the rest).
export class DeviceAuthorizationPending extends Schema.TaggedErrorClass<DeviceAuthorizationPending>(
  "DeviceAuthorizationPending",
)("DeviceAuthorizationPending", { message: Schema.String }, { httpApiStatus: 400 }) {}

export class DeviceTokenExpired extends Schema.TaggedErrorClass<DeviceTokenExpired>(
  "DeviceTokenExpired",
)("DeviceTokenExpired", { message: Schema.String }, { httpApiStatus: 400 }) {}

export class DeviceCodeNotFound extends Schema.TaggedErrorClass<DeviceCodeNotFound>(
  "DeviceCodeNotFound",
)("DeviceCodeNotFound", { message: Schema.String }, { httpApiStatus: 400 }) {}

export class DeviceGroup extends HttpApiGroup.make("cliAuth")
  .add(
    HttpApiEndpoint.post("deviceStart", "/start", {
      success: DeviceStartResponse,
      error: CustomHttpApiError.ServiceUnavailable,
    }),
  )
  .add(
    HttpApiEndpoint.post("deviceToken", "/token", {
      payload: DeviceTokenPayload,
      success: DeviceTokenResponse,
      error: [
        DeviceAuthorizationPending,
        DeviceTokenExpired,
        DeviceCodeNotFound,
        CustomHttpApiError.ServiceUnavailable,
      ],
    }),
  )
  // Both endpoints persist (start inserts, token mints) — transient store
  // failure surfaces as 503.
  .prefix("/cli/device") {}
