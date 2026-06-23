import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { mintApiTokenCore } from "@/modules/auth/commands/mint-api-token.js";
import {
  type PollDeviceGrantCommand,
  type PollDeviceGrantOutput,
} from "@/modules/auth/commands/poll-device-grant-command.js";
import { hashToken } from "@/modules/auth/domain/api-token-token.js";
import * as DeviceGrant from "@/modules/auth/domain/device-grant.aggregate.js";
import {
  DeviceGrantExpired,
  DeviceGrantPending,
} from "@/modules/auth/domain/device-grant-errors.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant-repository.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Single-use exchange. Hashes the presented device code, then:
//   - lapsed grant  → consume it + fail `DeviceGrantExpired`
//   - still pending  → fail `DeviceGrantPending` (CLI keeps polling)
//   - approved       → mint a token AND consume the grant in one transaction
//                      (so a token can never be minted twice from one grant).
// Minting reuses `mintApiTokenCore` (sans its own uow) to stay in this single
// transaction rather than nesting a savepoint.
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const pollDeviceGrant = (cmd: PollDeviceGrantCommand): PollDeviceGrantOutput =>
  Effect.gen(function* () {
    const grants = yield* DeviceGrantRepository;
    const grant = yield* grants.findByCodeHash(hashToken(cmd.deviceCode));
    const now = yield* DateTime.now;

    if (DeviceGrant.isExpired(grant, now)) {
      yield* grants
        .delete(grant.id)
        .pipe(Effect.catchTag("DeviceGrantNotFound", () => Effect.void));
      return yield* Effect.fail(new DeviceGrantExpired());
    }
    if (grant.status === "pending" || grant.userId === null) {
      return yield* Effect.fail(new DeviceGrantPending());
    }

    const minted = yield* mintApiTokenCore({
      userId: grant.userId,
      label: "cli",
      expiresInDays: cmd.tokenExpiresInDays,
    });
    yield* grants.delete(grant.id);
    return minted;
  }).pipe(withUnitOfWork);
