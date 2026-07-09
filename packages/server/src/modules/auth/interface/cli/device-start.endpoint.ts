import { CliAuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { EnvVars } from "@/common/env-vars.js";
import { StartDeviceGrantCommand } from "@/modules/auth/commands/start-device-grant.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// CLI adapter (ADR-0024): starts a device grant and returns the codes plus
// the verification URL the user should open. Dispatches the same
// `StartDeviceGrantCommand` the bus exposes — no GUI coupling.
export const deviceStartEndpoint = Effect.fn("CliAuthLive.deviceStart")(function* (
  _request: EndpointRequest<typeof CliAuthContract.DeviceGroup, "deviceStart">,
) {
  const env = yield* EnvVars;
  const commandBus = yield* CommandBus;
  const { deviceCode, userCode } = yield* commandBus.execute(
    StartDeviceGrantCommand.make({ ttlSeconds: env.DEVICE_CODE_TTL_SECONDS }),
  );
  const verificationUri = `${env.APP_URL}/device`;
  return new CliAuthContract.DeviceStartResponse({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?code=${encodeURIComponent(userCode)}`,
    interval: env.DEVICE_POLL_INTERVAL_SECONDS,
    expires_in: env.DEVICE_CODE_TTL_SECONDS,
  });
}, recoverPersistenceUnavailable);
