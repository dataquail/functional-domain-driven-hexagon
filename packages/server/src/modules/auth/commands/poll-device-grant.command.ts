import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { MintApiTokenResultView } from "@/modules/auth/commands/mint-api-token.command.js";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
  DeviceGrantPending,
} from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

// CLI poll: exchange a device code for an app token once the grant is approved.
// `tokenExpiresInDays` is resolved by the endpoint from config. It mints on the user's behalf,
// so it returns the same result view the mint command does.
export const PollDeviceGrant = Command.make("PollDeviceGrantCommand", {
  payload: { deviceCode: Schema.String, tokenExpiresInDays: Schema.Number },
  success: MintApiTokenResultView,
  failure: Schema.Union([
    DeviceGrantNotFound,
    DeviceGrantExpired,
    DeviceGrantPending,
    PersistenceUnavailable,
  ]),
});
export type PollDeviceGrantPayload = Command.Payload<typeof PollDeviceGrant>;
