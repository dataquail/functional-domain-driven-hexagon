import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type ApproveDeviceGrantCommand } from "@/modules/auth/commands/approve-device-grant.command.js";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant/device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "@/modules/auth/domain/device-grant/device-grant.specification.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Looks up the grant by its user code, refuses a lapsed one, and binds it to
// the approving user. Idempotent: re-approving an already-approved grant just
// re-stamps it (a double-submit from the browser is harmless).
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const approveDeviceGrant = Effect.fn("approveDeviceGrant")(function* (
  cmd: ApproveDeviceGrantCommand,
) {
  const repo = yield* DeviceGrantRepository;
  const grant = yield* repo.findOne(DeviceGrantSpecifications.withUserCode(cmd.userCode));
  if (grant === null) {
    return yield* new DeviceGrantNotFound();
  }
  const now = yield* DateTime.now;
  if (DeviceGrantSpecifications.isExpired(grant, now)) {
    return yield* new DeviceGrantExpired();
  }
  yield* repo.updateOne(DeviceGrantRootOps.approve({ grant, userId: cmd.userId, now }));
}, withUnitOfWork);
