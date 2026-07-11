import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ApproveDeviceGrantCommand } from "@/modules/auth/commands/approve-device-grant.command.js";
import { approveDeviceGrant } from "@/modules/auth/commands/approve-device-grant.handler.js";
import { PollDeviceGrantCommand } from "@/modules/auth/commands/poll-device-grant.command.js";
import { pollDeviceGrant } from "@/modules/auth/commands/poll-device-grant.handler.js";
import { StartDeviceGrantCommand } from "@/modules/auth/commands/start-device-grant.command.js";
import { startDeviceGrant } from "@/modules/auth/commands/start-device-grant.handler.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
  DeviceGrantPending,
} from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { CredentialHash } from "@/modules/auth/domain/domain-services/credential-hash.domain-service.js";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake.js";
import { DeviceGrantRepositoryFake } from "@/modules/auth/infrastructure/repositories/device-grant.repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const TestLayer = Layer.mergeAll(
  DeviceGrantRepositoryFake,
  ApiTokenRepositoryFake,
  IdentityUnitOfWork,
);
const poll = (deviceCode: string) =>
  pollDeviceGrant(PollDeviceGrantCommand.make({ deviceCode, tokenExpiresInDays: 90 }));
const errorOf = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && Cause.hasFails(exit.cause)
    ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
    : null;

describe("pollDeviceGrant", () => {
  it.effect("fails DeviceGrantPending before approval", () =>
    Effect.gen(function* () {
      const { deviceCode } = yield* startDeviceGrant(
        StartDeviceGrantCommand.make({ ttlSeconds: 600 }),
      );
      deepStrictEqual(
        errorOf(yield* Effect.exit(poll(deviceCode))) instanceof DeviceGrantPending,
        true,
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("mints a token on approval and consumes the grant (single-use)", () =>
    Effect.gen(function* () {
      const { deviceCode, userCode } = yield* startDeviceGrant(
        StartDeviceGrantCommand.make({ ttlSeconds: 600 }),
      );
      yield* approveDeviceGrant(ApproveDeviceGrantCommand.make({ userCode, userId }));

      const { apiToken, token } = yield* poll(deviceCode);
      ok(token.startsWith("pat_"));
      deepStrictEqual(apiToken.userId, userId);
      // Minted token is resolvable by its hash…
      const apiTokens = yield* ApiTokenRepository;
      deepStrictEqual((yield* apiTokens.findOneByHash(CredentialHash.of(token))).id, apiToken.id);
      // …and the grant is consumed: a second poll finds nothing.
      const grants = yield* DeviceGrantRepository;
      deepStrictEqual(
        Exit.isFailure(yield* Effect.exit(grants.findOneByCodeHash(CredentialHash.of(deviceCode)))),
        true,
      );
      deepStrictEqual(
        errorOf(yield* Effect.exit(poll(deviceCode))) instanceof DeviceGrantNotFound,
        true,
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DeviceGrantExpired for a lapsed grant", () =>
    Effect.gen(function* () {
      const { deviceCode } = yield* startDeviceGrant(
        StartDeviceGrantCommand.make({ ttlSeconds: -10 }),
      );
      deepStrictEqual(
        errorOf(yield* Effect.exit(poll(deviceCode))) instanceof DeviceGrantExpired,
        true,
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DeviceGrantNotFound for an unknown device code", () =>
    Effect.gen(function* () {
      deepStrictEqual(
        errorOf(yield* Effect.exit(poll("bogus"))) instanceof DeviceGrantNotFound,
        true,
      );
    }).pipe(Effect.provide(TestLayer)),
  );
});
