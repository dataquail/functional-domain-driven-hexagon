import { randomBytes, randomUUID } from "node:crypto";

import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type StartDeviceGrantPayload } from "@/modules/auth/commands/start-device-grant.command.js";
import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant/device-grant.root-ops.js";
import { CredentialHash } from "@/modules/auth/domain/domain-services/credential-hash.domain-service.js";

// Mints a high-entropy device code (returned once, only its hash stored) and
// a short human-typable user code, persists a pending grant, and returns the
// codes for the CLI + the verification page. A user-code collision within
// the short TTL window is astronomically unlikely; if one ever hit the
// unique index, the insert surfaces as a defect (retry is the CLI's job).
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const startDeviceGrantHandler = Effect.fn("startDeviceGrantHandler")(function* (
  cmd: StartDeviceGrantPayload,
) {
  const repo = yield* DeviceGrantRepository;
  const { deviceCode, userCode } = yield* Effect.sync(() => ({
    deviceCode: randomBytes(32).toString("base64url"),
    userCode: DeviceGrantRootOps.toUserCode(randomBytes(16)),
  }));
  const id = DeviceGrantId.make(yield* Effect.sync(() => randomUUID()));
  const now = yield* DateTime.now;
  const grant = DeviceGrantRootOps.start({
    id,
    deviceCodeHash: CredentialHash.of(deviceCode),
    userCode,
    now,
    ttlSeconds: cmd.ttlSeconds,
  });
  yield* repo.insertOne(grant);
  return { deviceCode, userCode, expiresAt: grant.expiresAt };
}, withUnitOfWork);
