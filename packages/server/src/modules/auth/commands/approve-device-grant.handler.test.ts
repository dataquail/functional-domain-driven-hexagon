import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { approveDeviceGrantHandler } from "@/modules/auth/commands/approve-device-grant.handler.ts";
import { startDeviceGrantHandler } from "@/modules/auth/commands/start-device-grant.handler.ts";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "@/modules/auth/domain/device-grant/device-grant.errors.ts";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.ts";
import { DeviceGrantSpecifications } from "@/modules/auth/domain/device-grant/device-grant.specification.ts";
import { DeviceGrantRepositoryFake } from "@/modules/auth/infrastructure/repositories/device-grant.repository-fake.ts";
import { CryptoFake } from "@/test-utils/crypto-fake.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const TestLayer = Layer.mergeAll(DeviceGrantRepositoryFake, PassThroughUnitOfWork, CryptoFake);

describe("approveDeviceGrantHandler", () => {
  it.effect("binds a pending grant to the approving user", () =>
    Effect.gen(function* () {
      const { userCode } = yield* startDeviceGrantHandler({ ttlSeconds: 600 });
      yield* approveDeviceGrantHandler({ userCode, userId });
      const repo = yield* DeviceGrantRepository;

      const grant = yield* repo
        .findOne(DeviceGrantSpecifications.withUserCode(userCode))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(grant.status, "approved");
      deepStrictEqual(grant.userId, Option.some(userId));
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DeviceGrantNotFound for an unknown user code", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        approveDeviceGrantHandler({ userCode: "ZZZZ-9999", userId }),
      );

      assertInstanceOf(error, DeviceGrantNotFound);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DeviceGrantExpired for a lapsed grant", () =>
    Effect.gen(function* () {
      const { userCode } = yield* startDeviceGrantHandler({ ttlSeconds: -10 });
      const error = yield* Effect.flip(approveDeviceGrantHandler({ userCode, userId }));
      assertInstanceOf(error, DeviceGrantExpired);
    }).pipe(Effect.provide(TestLayer)),
  );
});
