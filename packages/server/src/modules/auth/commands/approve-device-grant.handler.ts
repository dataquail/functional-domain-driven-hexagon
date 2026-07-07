import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type ApproveDeviceGrantCommand,
  type ApproveDeviceGrantOutput,
} from "@/modules/auth/commands/approve-device-grant.command.js";
import { DeviceGrantExpired } from "@/modules/auth/domain/device-grant.errors.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant.root.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant.repository.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Looks up the grant by its user code, refuses a lapsed one, and binds it to
// the approving user. Idempotent: re-approving an already-approved grant just
// re-stamps it (a double-submit from the browser is harmless).
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const approveDeviceGrant = (cmd: ApproveDeviceGrantCommand): ApproveDeviceGrantOutput =>
  Effect.gen(function* () {
    const repo = yield* DeviceGrantRepository;
    const grant = yield* repo.findOneByUserCode(cmd.userCode);
    const now = yield* DateTime.now;
    if (DeviceGrantRootOps.isExpired(grant, now)) {
      return yield* Effect.fail(new DeviceGrantExpired());
    }
    yield* repo.updateOne(DeviceGrantRootOps.approve({ grant, userId: cmd.userId, now }));
  }).pipe(withUnitOfWork);
