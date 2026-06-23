import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { DeviceGrantId } from "./device-grant-id.js";

// A short-lived OAuth 2.0 Device Authorization Grant (RFC 8628), app-native:
// the CLI starts one, the user approves it in the browser (already signed in),
// and the CLI polls until it can exchange the device code for an app token.
// Only the sha256 hash of the device code is retained; the user code is a
// low-entropy, single-use, short-TTL value typed by a human, stored plaintext.
export class DeviceGrant extends Schema.Class<DeviceGrant>("DeviceGrant")({
  id: DeviceGrantId,
  deviceCodeHash: Schema.String,
  userCode: Schema.String,
  status: Schema.Literal("pending", "approved"),
  userId: Schema.NullOr(UserId),
  createdAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc,
  approvedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

export type StartInput = {
  readonly id: DeviceGrantId;
  readonly deviceCodeHash: string;
  readonly userCode: string;
  readonly now: DateTime.Utc;
  readonly ttlSeconds: number;
};

export const start = (input: StartInput): DeviceGrant =>
  DeviceGrant.make({
    id: input.id,
    deviceCodeHash: input.deviceCodeHash,
    userCode: input.userCode,
    status: "pending",
    userId: null,
    createdAt: input.now,
    expiresAt: DateTime.add(input.now, { seconds: input.ttlSeconds }),
    approvedAt: null,
  });

export type ApproveInput = {
  readonly grant: DeviceGrant;
  readonly userId: UserId;
  readonly now: DateTime.Utc;
};

// Binds the grant to the approving user. Pure; the use case enforces the
// guards (must be unexpired) before calling. Idempotent on an
// already-approved grant — re-approval just re-stamps.
export const approve = (input: ApproveInput): DeviceGrant =>
  DeviceGrant.make({
    id: input.grant.id,
    deviceCodeHash: input.grant.deviceCodeHash,
    userCode: input.grant.userCode,
    status: "approved",
    userId: input.userId,
    createdAt: input.grant.createdAt,
    expiresAt: input.grant.expiresAt,
    approvedAt: input.now,
  });

export const isExpired = (grant: DeviceGrant, now: DateTime.Utc): boolean =>
  DateTime.lessThanOrEqualTo(grant.expiresAt, now);
