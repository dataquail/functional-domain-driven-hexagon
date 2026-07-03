import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { StartDeviceGrantCommand } from "@/modules/auth/commands/start-device-grant.command.js";
import { startDeviceGrant } from "@/modules/auth/commands/start-device-grant.handler.js";
import { CredentialHash } from "@/modules/auth/domain/credential-hash.domain-service.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant.repository.js";
import { DeviceGrantRepositoryFake } from "@/modules/auth/infrastructure/repositories/device-grant.repository-fake.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";

const TestLayer = Layer.mergeAll(DeviceGrantRepositoryFake, IdentityUnitOfWork);

describe("startDeviceGrant", () => {
  it.effect("returns codes and persists a pending grant keyed by the device-code hash", () =>
    Effect.gen(function* () {
      const { deviceCode, userCode } = yield* startDeviceGrant(
        StartDeviceGrantCommand.make({ ttlSeconds: 600 }),
      );
      ok(deviceCode.length > 0);
      ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(userCode));

      const repo = yield* DeviceGrantRepository;
      const stored = yield* repo.findOneByCodeHash(CredentialHash.of(deviceCode));
      deepStrictEqual(stored.status, "pending");
      deepStrictEqual(stored.userId, null);
      deepStrictEqual(stored.userCode, userCode);
    }).pipe(Effect.provide(TestLayer)),
  );
});
