import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { type ApproveDeviceGrantPayload } from "@/modules/auth/commands/approve-device-grant.command.ts";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "@/modules/auth/domain/device-grant/device-grant.errors.ts";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.ts";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant/device-grant.root-ops.ts";
import { DeviceGrantSpecifications } from "@/modules/auth/domain/device-grant/device-grant.specification.ts";

// Looks up the grant by its user code, refuses a lapsed one, and binds it to
// the approving user. Idempotent: re-approving an already-approved grant just
// re-stamps it (a double-submit from the browser is harmless).
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const approveDeviceGrantHandler = Effect.fn("approveDeviceGrantHandler")(function* (
  cmd: ApproveDeviceGrantPayload,
) {
  const repo = yield* DeviceGrantRepository;
  const found = yield* repo.findOne(DeviceGrantSpecifications.withUserCode(cmd.userCode));

  if (Option.isNone(found)) {
    return yield* new DeviceGrantNotFound();
  }

  const grant = found.value;

  const now = yield* DateTime.now;

  if (DeviceGrantSpecifications.isExpired(grant, now)) {
    return yield* new DeviceGrantExpired();
  }

  yield* repo.updateOne(DeviceGrantRootOps.approve({ grant, userId: cmd.userId, now }));
}, withUnitOfWork);
