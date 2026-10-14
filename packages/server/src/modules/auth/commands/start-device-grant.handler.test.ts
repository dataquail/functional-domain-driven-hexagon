import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { startDeviceGrantHandler } from "@/modules/auth/commands/start-device-grant.handler.ts";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.ts";
import { DeviceGrantSpecifications } from "@/modules/auth/domain/device-grant/device-grant.specification.ts";
import { CredentialHash } from "@/modules/auth/domain/domain-services/credential-hash.domain-service.ts";
import { DeviceGrantRepositoryFake } from "@/modules/auth/infrastructure/repositories/device-grant.repository-fake.ts";
import { CryptoFake } from "@/test-utils/crypto-fake.ts";

const TestLayer = Layer.mergeAll(DeviceGrantRepositoryFake, PassThroughUnitOfWork, CryptoFake);

describe("startDeviceGrantHandler", () => {
  it.effect("returns codes and persists a pending grant keyed by the device-code hash", () =>
    Effect.gen(function* () {
      const { deviceCode, userCode } = yield* startDeviceGrantHandler({ ttlSeconds: 600 });
      ok(deviceCode.length > 0);
      ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(userCode));

      const repo = yield* DeviceGrantRepository;

      const stored = yield* repo
        .findOne(DeviceGrantSpecifications.withCodeHash(CredentialHash.of(deviceCode)))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(stored.status, "pending");
      assertNone(stored.userId);
      deepStrictEqual(stored.userCode, userCode);
    }).pipe(Effect.provide(TestLayer)),
  );
});
