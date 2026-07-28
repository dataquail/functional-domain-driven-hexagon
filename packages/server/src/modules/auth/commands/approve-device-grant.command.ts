import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Browser-side approval: the signed-in user submits the `userCode` they were
// shown by the CLI; we bind the grant to them.
export const ApproveDeviceGrant = Command.make("ApproveDeviceGrantCommand", {
  payload: { userCode: Schema.String, userId: UserId },
  success: Schema.Void,
  failure: Schema.Union([DeviceGrantNotFound, DeviceGrantExpired, PersistenceUnavailable]),
});
export type ApproveDeviceGrantPayload = Command.Payload<typeof ApproveDeviceGrant>;
