import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { beforeEach } from "vitest";

import { roleCommandHandlers } from "@/modules/role/index.js";
import { RoleManagement } from "@/modules/user/domain/ports/external/role-management.js";
import { RoleManagementLive } from "@/modules/user/infrastructure/external/role-management-live.js";
import { makeCommandBus } from "@/platform/command-bus-live.js";
import { CommandBus, type CommandHandlers } from "@/platform/ddd/command-bus.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

// Sub-graph integration test (ADR-0023): wires the outbound adapter to a
// real command bus carrying the role module's handlers, against a live
// DB. Exercises the adapter's job — dispatching the right command and
// translating role-module errors into the port's user-owned errors. The
// bus is built from just the role handlers; the cast is the localized
// concession `makeCommandBus`'s full-registry signature forces in a test.
const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const actorId = UserId.make("22222222-2222-2222-2222-222222222222");

const RoleRowStd = Schema.standardSchemaV1(Schema.Struct({ role: Schema.String }));

// platform.roles FKs to user.users(id); seed the target user's row.
const seedUser = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const rolesFor = (id: UserId) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    return yield* db
      .execute((client) =>
        client.any(sql.type(RoleRowStd)`SELECT role FROM platform.roles WHERE user_id = ${id}`),
      )
      .pipe(
        Effect.map((rows) => rows.map((r) => r.role)),
        Effect.orDie,
      );
  });

const CommandBusLive = Layer.succeed(
  CommandBus,
  makeCommandBus(roleCommandHandlers as unknown as CommandHandlers),
);

const TestLayer = RoleManagementLive.pipe(
  Layer.provide(CommandBusLive),
  Layer.provide(RecordingEventBus),
  Layer.provide(IdentityUnitOfWork),
  Layer.provideMerge(TestDatabaseLive),
);

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("RoleManagementLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("platform.roles", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("grantSuperAdmin persists the super_admin role", () =>
    Effect.gen(function* () {
      yield* seedUser;
      const mgmt = yield* RoleManagement;
      yield* mgmt.grantSuperAdmin({ userId, actorUserId: actorId });
      deepStrictEqual(yield* rolesFor(userId), ["super_admin"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("grantSuperAdmin is idempotent when the role is already held", () =>
    Effect.gen(function* () {
      yield* seedUser;
      const mgmt = yield* RoleManagement;
      yield* mgmt.grantSuperAdmin({ userId, actorUserId: actorId });
      yield* mgmt.grantSuperAdmin({ userId, actorUserId: actorId });
      deepStrictEqual(yield* rolesFor(userId), ["super_admin"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("grantSuperAdmin maps self-promotion to SelfPromotionForbidden", () =>
    Effect.gen(function* () {
      yield* seedUser;
      const mgmt = yield* RoleManagement;
      const error = yield* mgmt.grantSuperAdmin({ userId, actorUserId: userId }).pipe(Effect.flip);
      deepStrictEqual(error._tag, "SelfPromotionForbidden");
      deepStrictEqual(yield* rolesFor(userId), []);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("revokeSuperAdmin removes the role", () =>
    Effect.gen(function* () {
      yield* seedUser;
      const mgmt = yield* RoleManagement;
      yield* mgmt.grantSuperAdmin({ userId, actorUserId: actorId });
      yield* mgmt.revokeSuperAdmin({ userId });
      deepStrictEqual(yield* rolesFor(userId), []);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("revokeSuperAdmin is idempotent when the role was never held", () =>
    Effect.gen(function* () {
      yield* seedUser;
      const mgmt = yield* RoleManagement;
      yield* mgmt.revokeSuperAdmin({ userId });
      deepStrictEqual(yield* rolesFor(userId), []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
