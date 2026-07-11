import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant/device-grant.root-ops.js";
import { DeviceGrantRepositoryLive } from "@/modules/auth/infrastructure/repositories/device-grant.repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const id = DeviceGrantId.make("22222222-2222-2222-2222-222222222222");

const TestLayer = DeviceGrantRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const insertUserRow = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'device@example.com', 'N/A', 'N/A', 'N/A', now(), now())
    `),
  );
}).pipe(Effect.orDie);

const start = (now: DateTime.Utc) =>
  DeviceGrantRootOps.start({
    id,
    deviceCodeHash: "dc-hash",
    userCode: "ABCD-2345",
    now,
    ttlSeconds: 600,
  });

const suite = describe.sequential;

suite("DeviceGrantRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("auth.device_grants", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("insert + findOneByCodeHash + findOneByUserCode round-trip", () =>
    Effect.gen(function* () {
      const repo = yield* DeviceGrantRepository;
      const now = yield* DateTime.now;
      yield* repo.insertOne(start(now));
      deepStrictEqual((yield* repo.findOneByCodeHash("dc-hash")).id, id);
      const byUser = yield* repo.findOneByUserCode("ABCD-2345");
      deepStrictEqual(byUser.status, "pending");
      deepStrictEqual(byUser.userId, null);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("update persists an approval (status + user_id + approved_at)", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* DeviceGrantRepository;
      const now = yield* DateTime.now;
      const grant = start(now);
      yield* repo.insertOne(grant);
      yield* repo.updateOne(DeviceGrantRootOps.approve({ grant, userId, now }));
      const after = yield* repo.findOneByCodeHash("dc-hash");
      deepStrictEqual(after.status, "approved");
      deepStrictEqual(after.userId, userId);
      deepStrictEqual(after.approvedAt !== null, true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("delete consumes the grant; a second delete is NotFound", () =>
    Effect.gen(function* () {
      const repo = yield* DeviceGrantRepository;
      const now = yield* DateTime.now;
      yield* repo.insertOne(start(now));
      yield* repo.deleteOne(id);
      const lookup = yield* Effect.exit(repo.findOneByCodeHash("dc-hash"));
      deepStrictEqual(Exit.isFailure(lookup), true);
      if (Exit.isFailure(lookup)) {
        const error = Cause.hasFails(lookup.cause)
          ? Cause.findErrorOption(lookup.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof DeviceGrantNotFound, true);
      }
      const second = yield* Effect.exit(repo.deleteOne(id));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
