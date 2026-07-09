import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { mintApiTokenCore } from "@/modules/auth/commands/mint-api-token.handler.js";
import { type PollDeviceGrantCommand } from "@/modules/auth/commands/poll-device-grant.command.js";
import { CredentialHash } from "@/modules/auth/domain/credential-hash.domain-service.js";
import {
  DeviceGrantExpired,
  DeviceGrantPending,
} from "@/modules/auth/domain/device-grant.errors.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant.root.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant.repository.js";
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
export const pollDeviceGrant = Effect.fn("pollDeviceGrant")(function* (
  cmd: PollDeviceGrantCommand,
) {
  const grants = yield* DeviceGrantRepository;
  const grant = yield* grants.findOneByCodeHash(CredentialHash.of(cmd.deviceCode));
  const now = yield* DateTime.now;

  if (DeviceGrantRootOps.isExpired(grant, now)) {
    yield* grants
      .deleteOne(grant.id)
      .pipe(Effect.catchTag("DeviceGrantNotFound", () => Effect.void));
    return yield* new DeviceGrantExpired();
  }
  if (grant.status === "pending" || grant.userId === null) {
    return yield* new DeviceGrantPending();
  }

  const minted = yield* mintApiTokenCore({
    userId: grant.userId,
    label: "cli",
    expiresInDays: cmd.tokenExpiresInDays,
  });
  yield* grants.deleteOne(grant.id);
  return minted;
}, withUnitOfWork);
