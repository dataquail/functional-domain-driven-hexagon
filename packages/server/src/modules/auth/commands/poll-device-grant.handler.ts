import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { mintApiTokenCore } from "@/modules/auth/commands/mint-api-token.handler.ts";
import { type PollDeviceGrantPayload } from "@/modules/auth/commands/poll-device-grant.command.ts";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
  DeviceGrantPending,
} from "@/modules/auth/domain/device-grant/device-grant.errors.ts";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.ts";
import { DeviceGrantSpecifications } from "@/modules/auth/domain/device-grant/device-grant.specification.ts";
import { CredentialHash } from "@/modules/auth/domain/domain-services/credential-hash.domain-service.ts";

// Single-use exchange. Hashes the presented device code, then:
//   - lapsed grant  → consume it + fail `DeviceGrantExpired`
//   - still pending  → fail `DeviceGrantPending` (CLI keeps polling)
//   - approved       → mint a token AND consume the grant in one transaction
//                      (so a token can never be minted twice from one grant).
// Minting reuses `mintApiTokenCore` (sans its own uow) to stay in this single
// transaction rather than nesting a savepoint.
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const pollDeviceGrantHandler = Effect.fn("pollDeviceGrantHandler")(function* (
  cmd: PollDeviceGrantPayload,
) {
  const grants = yield* DeviceGrantRepository;

  const found = yield* grants.findOne(
    DeviceGrantSpecifications.withCodeHash(CredentialHash.of(cmd.deviceCode)),
  );

  if (Option.isNone(found)) {
    return yield* new DeviceGrantNotFound();
  }

  const grant = found.value;

  const now = yield* DateTime.now;

  if (DeviceGrantSpecifications.isExpired(grant, now)) {
    yield* grants
      .deleteOne(grant.id)
      .pipe(Effect.catchTag("DeviceGrantNotFound", () => Effect.void));

    return yield* new DeviceGrantExpired();
  }

  if (grant.status === "pending" || Option.isNone(grant.userId)) {
    return yield* new DeviceGrantPending();
  }

  const minted = yield* mintApiTokenCore({
    userId: grant.userId.value,
    label: "cli",
    expiresInDays: cmd.tokenExpiresInDays,
  });

  yield* grants.deleteOne(grant.id);

  return minted;
}, withUnitOfWork);
