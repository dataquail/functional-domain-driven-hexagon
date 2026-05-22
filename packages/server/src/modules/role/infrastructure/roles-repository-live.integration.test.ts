import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { empty as emptyRoles, grant, revoke } from "@/modules/role/domain/roles.aggregate.js";
import { RolesRepository } from "@/modules/role/domain/roles-repository.js";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/roles-repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

// platform.roles FKs to user.users(id) — every test seeds the FK row
// via raw SQL since the role module's barrel doesn't (and shouldn't)
// re-export the user module's repository internals.
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

const TestLayer = RolesRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("RolesRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("platform.roles", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  describe("findByUserId", () => {
    it.effect("returns an empty aggregate when no rows exist", () =>
      Effect.gen(function* () {
        yield* seedUser;
        const repo = yield* RolesRepository;
        const roles = yield* repo.findByUserId(userId);
        deepStrictEqual(roles.userId, userId);
        deepStrictEqual([...roles.roles], []);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("save", () => {
    it.effect("persists granted roles and round-trips via findByUserId", () =>
      Effect.gen(function* () {
        yield* seedUser;
        const repo = yield* RolesRepository;
        const granted = grant(emptyRoles(userId), "super_admin");
        if (Either.isLeft(granted)) throw new Error("expected Right");
        yield* repo.save(granted.right.roles);
        const fetched = yield* repo.findByUserId(userId);
        deepStrictEqual([...fetched.roles], ["super_admin"]);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("replaces existing rows when an aggregate revokes a role", () =>
      Effect.gen(function* () {
        yield* seedUser;
        const repo = yield* RolesRepository;
        const granted = grant(emptyRoles(userId), "super_admin");
        if (Either.isLeft(granted)) throw new Error("expected Right");
        yield* repo.save(granted.right.roles);
        const revoked = revoke(granted.right.roles, "super_admin");
        if (Either.isLeft(revoked)) throw new Error("expected Right");
        yield* repo.save(revoked.right.roles);
        const fetched = yield* repo.findByUserId(userId);
        deepStrictEqual([...fetched.roles], []);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
