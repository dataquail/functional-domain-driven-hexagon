import { CliAuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { EnvVars } from "@/common/env-vars.js";
import { PollDeviceGrantCommand } from "@/modules/auth/commands/poll-device-grant.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// CLI adapter (ADR-0005): the poll/exchange endpoint. Maps the device-grant
// domain errors to the RFC-8628-shaped contract errors the CLI switches on
// (keep polling on pending; stop on expired/unknown).
export const deviceTokenEndpoint = Effect.fn("CliAuthLive.deviceToken")(
  function* (request: EndpointRequest<typeof CliAuthContract.DeviceGroup, "deviceToken">) {
    const env = yield* EnvVars;
    const commandBus = yield* CommandBus;
    const { apiToken, token } = yield* commandBus.execute(
      PollDeviceGrantCommand.make({
        deviceCode: request.payload.device_code,
        tokenExpiresInDays: env.API_TOKEN_DEFAULT_TTL_DAYS,
      }),
    );
    return new CliAuthContract.DeviceTokenResponse({
      access_token: token,
      token_type: "Bearer",
      expires_at: apiToken.expiresAt,
    });
  },
  Effect.catchTag("DeviceGrantPending", () =>
    Effect.fail(
      new CliAuthContract.DeviceAuthorizationPending({ message: "authorization_pending" }),
    ),
  ),
  Effect.catchTag("DeviceGrantExpired", () =>
    Effect.fail(new CliAuthContract.DeviceTokenExpired({ message: "expired_token" })),
  ),
  Effect.catchTag("DeviceGrantNotFound", () =>
    Effect.fail(new CliAuthContract.DeviceCodeNotFound({ message: "invalid device code" })),
  ),
  recoverPersistenceUnavailable,
);
