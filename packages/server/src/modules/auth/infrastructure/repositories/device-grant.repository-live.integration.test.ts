import { deepStrictEqual } from "node:assert";

import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant/device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "@/modules/auth/domain/device-grant/device-grant.specification.js";
import { DeviceGrantRepositoryLive } from "@/modules/auth/infrastructure/repositories/device-grant.repository-live.js";
import { describeIntegration } from "@/test-utils/server-test-runtime.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const id = DeviceGrantId.make("22222222-2222-2222-2222-222222222222");

const TestLayer = DeviceGrantRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const insertUserRow = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'device@example.com', 'N/A', 'N/A', 'N/A', now(), now())
    `;
}).pipe(Effect.orDie);

const start = (now: DateTime.Utc) =>
  DeviceGrantRootOps.start({
    id,
    deviceCodeHash: "dc-hash",
    userCode: "ABCD-2345",
    now,
    ttlSeconds: 600,
  });

describeIntegration(
  "DeviceGrantRepositoryLive (integration)",
  { layer: TestLayer, tables: ["auth.device_grants", "user.users"] },
  (it) => {
    it.effect("insert + findOne by code hash and by user code round-trip", () =>
      Effect.gen(function* () {
        const repo = yield* DeviceGrantRepository;
        const now = yield* DateTime.now;
        yield* repo.insertOne(start(now));

        const byHash = yield* repo
          .findOne(DeviceGrantSpecifications.withCodeHash("dc-hash"))
          .pipe(Effect.flatMap(Effect.fromOption));

        const byUser = yield* repo
          .findOne(DeviceGrantSpecifications.withUserCode("ABCD-2345"))
          .pipe(Effect.flatMap(Effect.fromOption));

        deepStrictEqual(byHash.id, id);
        deepStrictEqual(byUser.status, "pending");
        assertNone(byUser.userId);
      }),
    );

    it.effect("update persists an approval (status + user_id + approved_at)", () =>
      Effect.gen(function* () {
        yield* insertUserRow;
        const repo = yield* DeviceGrantRepository;
        const now = yield* DateTime.now;
        const grant = start(now);
        yield* repo.insertOne(grant);
        yield* repo.updateOne(DeviceGrantRootOps.approve({ grant, userId, now }));

        const after = yield* repo
          .findOne(DeviceGrantSpecifications.withCodeHash("dc-hash"))
          .pipe(Effect.flatMap(Effect.fromOption));

        deepStrictEqual(after.status, "approved");
        deepStrictEqual(after.userId, Option.some(userId));
        assertTrue(Option.isSome(after.approvedAt));
      }),
    );

    it.effect("delete consumes the grant; a second delete is NotFound", () =>
      Effect.gen(function* () {
        const repo = yield* DeviceGrantRepository;
        const now = yield* DateTime.now;
        yield* repo.insertOne(start(now));
        yield* repo.deleteOne(id);
        const lookup = yield* repo.findOne(DeviceGrantSpecifications.withCodeHash("dc-hash"));
        assertNone(lookup);
        const second = yield* Effect.exit(repo.deleteOne(id));
        deepStrictEqual(Exit.isFailure(second), true);
      }),
    );
  },
);
