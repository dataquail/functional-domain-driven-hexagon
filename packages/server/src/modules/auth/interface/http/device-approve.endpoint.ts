import { type AuthContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { ApproveDeviceGrantCommand } from "@/modules/auth/commands/approve-device-grant.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// GUI adapter: the signed-in user approves a CLI device grant by submitting
// the code they were shown. Maps the device-grant domain errors to HTTP:
// unknown code → 404, lapsed → 410 Gone.
export const deviceApproveEndpoint = (
  request: EndpointRequest<typeof AuthContract.DeviceApprovalGroup, "approve">,
) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      ApproveDeviceGrantCommand.make({
        userCode: request.payload.userCode,
        userId: currentUser.userId,
      }),
    );
  }).pipe(
    Effect.catchTag("DeviceGrantNotFound", () =>
      Effect.fail(
        new CustomHttpApiError.NotFound({ message: "No pending device request for that code" }),
      ),
    ),
    Effect.catchTag("DeviceGrantExpired", () =>
      Effect.fail(new CustomHttpApiError.Gone({ message: "That device code has expired" })),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("AuthLive.device.approve"),
  );
