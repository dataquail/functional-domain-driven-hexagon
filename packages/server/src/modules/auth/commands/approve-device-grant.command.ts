import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { UserId } from "@/platform/ids/user-id.js";

// Browser-side approval: the signed-in user submits the `userCode` they were
// shown by the CLI; we bind the grant to them.
export const ApproveDeviceGrantCommand = Command.make("ApproveDeviceGrantCommand", {
  payload: { userCode: Schema.String, userId: UserId },
  success: Schema.Void,
  failure: Schema.Union([DeviceGrantNotFound, DeviceGrantExpired, PersistenceUnavailable]),
});
export type ApproveDeviceGrantPayload = Command.Payload<typeof ApproveDeviceGrantCommand>;
