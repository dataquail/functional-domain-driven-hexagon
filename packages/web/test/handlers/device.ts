// Per-feature MSW handler builders for the device-approval contract. Tests
// compose these per-scenario via `server.use(...)`. No shared state;
// each handler returns exactly what the test asks for.

import * as AuthContract from "@org/contracts/api/AuthContract";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { getEndpoint, typedHandler } from "../typed-handler";

const approveEndpoint = getEndpoint(AuthContract.DeviceApprovalGroup, "approve");

export const deviceHandlers = {
  /** POST /auth/device/approve — binds the grant to the signed-in caller. */
  approve: (
    outcome: { readonly result: "success" | "NotFound" | "Gone" } = { result: "success" },
  ) =>
    typedHandler(approveEndpoint, () => {
      if (outcome.result === "NotFound") {
        return Effect.fail(new CustomHttpApiError.NotFound({ message: "Unknown device code." }));
      }
      if (outcome.result === "Gone") {
        return Effect.fail(new CustomHttpApiError.Gone({ message: "That code has expired." }));
      }
      return Effect.void;
    }),
};
