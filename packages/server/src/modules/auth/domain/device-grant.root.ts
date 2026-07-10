import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { DeviceGrantId } from "./device-grant.id.js";

// A short-lived OAuth 2.0 Device Authorization Grant (RFC 8628), app-native:
// the CLI starts one, the user approves it in the browser (already signed in),
// and the CLI polls until it can exchange the device code for an app token.
// Only the sha256 hash of the device code is retained; the user code is a
// low-entropy, single-use, short-TTL value typed by a human, stored plaintext.
export class DeviceGrantRoot extends Schema.Class<DeviceGrantRoot>("DeviceGrantRoot")({
  id: DeviceGrantId,
  deviceCodeHash: Schema.String,
  userCode: Schema.String,
  status: Schema.Literals(["pending", "approved"]),
  userId: Schema.NullOr(UserId),
  createdAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc,
  approvedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}
