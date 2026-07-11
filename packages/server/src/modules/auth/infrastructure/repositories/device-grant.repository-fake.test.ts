import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant/device-grant.root-ops.js";
import { UserId } from "@/platform/ids/user-id.js";

import { DeviceGrantRepositoryFake } from "./device-grant.repository-fake.js";

const id = DeviceGrantId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const seed = () =>
  Effect.gen(function* () {
    const repo = yield* DeviceGrantRepository;
    const grant = DeviceGrantRootOps.start({
      id,
      deviceCodeHash: "dc-hash",
      userCode: "ABCD-2345",
      now,
      ttlSeconds: 600,
    });
    yield* repo.insertOne(grant);
    return grant;
  });

const provide = Effect.provide(DeviceGrantRepositoryFake);

describe("DeviceGrantRepositoryFake", () => {
  it.effect("insert + lookup by code hash and by user code", () =>
    Effect.gen(function* () {
      yield* seed();
      const repo = yield* DeviceGrantRepository;
      deepStrictEqual((yield* repo.findOneByCodeHash("dc-hash")).id, id);
      deepStrictEqual((yield* repo.findOneByUserCode("ABCD-2345")).id, id);
    }).pipe(provide),
  );

  it.effect("lookups fail DeviceGrantNotFound when absent", () =>
    Effect.gen(function* () {
      const repo = yield* DeviceGrantRepository;
      const exit = yield* Effect.exit(repo.findOneByUserCode("ZZZZ-9999"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof DeviceGrantNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("update persists approval", () =>
    Effect.gen(function* () {
      const grant = yield* seed();
      const repo = yield* DeviceGrantRepository;
      yield* repo.updateOne(DeviceGrantRootOps.approve({ grant, userId, now }));
      const after = yield* repo.findOneByCodeHash("dc-hash");
      deepStrictEqual(after.status, "approved");
      deepStrictEqual(after.userId, userId);
    }).pipe(provide),
  );

  it.effect("delete consumes the grant; a second delete fails NotFound", () =>
    Effect.gen(function* () {
      yield* seed();
      const repo = yield* DeviceGrantRepository;
      yield* repo.deleteOne(id);
      const lookup = yield* Effect.exit(repo.findOneByCodeHash("dc-hash"));
      deepStrictEqual(Exit.isFailure(lookup), true);
      const second = yield* Effect.exit(repo.deleteOne(id));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(provide),
  );
});
