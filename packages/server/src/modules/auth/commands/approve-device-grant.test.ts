import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { approveDeviceGrant } from "@/modules/auth/commands/approve-device-grant.js";
import { ApproveDeviceGrantCommand } from "@/modules/auth/commands/approve-device-grant-command.js";
import { startDeviceGrant } from "@/modules/auth/commands/start-device-grant.js";
import { StartDeviceGrantCommand } from "@/modules/auth/commands/start-device-grant-command.js";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "@/modules/auth/domain/device-grant-errors.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant-repository.js";
import { DeviceGrantRepositoryFake } from "@/modules/auth/infrastructure/device-grant-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const TestLayer = Layer.mergeAll(DeviceGrantRepositoryFake, IdentityUnitOfWork);
const errorOf = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && exit.cause._tag === "Fail" ? exit.cause.error : null;

describe("approveDeviceGrant", () => {
  it.effect("binds a pending grant to the approving user", () =>
    Effect.gen(function* () {
      const { userCode } = yield* startDeviceGrant(
        StartDeviceGrantCommand.make({ ttlSeconds: 600 }),
      );
      yield* approveDeviceGrant(ApproveDeviceGrantCommand.make({ userCode, userId }));
      const repo = yield* DeviceGrantRepository;
      const grant = yield* repo.findOneByUserCode(userCode);
      deepStrictEqual(grant.status, "approved");
      deepStrictEqual(grant.userId, userId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DeviceGrantNotFound for an unknown user code", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        approveDeviceGrant(ApproveDeviceGrantCommand.make({ userCode: "ZZZZ-9999", userId })),
      );
      deepStrictEqual(errorOf(exit) instanceof DeviceGrantNotFound, true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DeviceGrantExpired for a lapsed grant", () =>
    Effect.gen(function* () {
      const { userCode } = yield* startDeviceGrant(
        StartDeviceGrantCommand.make({ ttlSeconds: -10 }),
      );
      const exit = yield* Effect.exit(
        approveDeviceGrant(ApproveDeviceGrantCommand.make({ userCode, userId })),
      );
      deepStrictEqual(errorOf(exit) instanceof DeviceGrantExpired, true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
