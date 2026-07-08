import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles.repository.js";
import { RolesRootOps } from "@/modules/role/domain/roles.root.js";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/repositories/roles.repository-live.js";
import { findUserRoles } from "@/modules/role/queries/find-user-roles.handler.js";
import { FindUserRolesQuery } from "@/modules/role/queries/find-user-roles.query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const TestLayer = RolesRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUser = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'member@example.com', 'USA', '1 St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const suite = describe.sequential;

suite("findUserRoles (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("platform.roles", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("returns an empty role array for a user with none granted", () =>
    Effect.gen(function* () {
      yield* seedUser;
      const result = yield* findUserRoles(FindUserRolesQuery.make({ userId }));
      deepStrictEqual(result.userId, userId);
      deepStrictEqual([...result.roles], []);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns the granted roles", () =>
    Effect.gen(function* () {
      yield* seedUser;
      const repo = yield* RolesRepository;
      const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
      if (Either.isLeft(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.right.roles);
      const result = yield* findUserRoles(FindUserRolesQuery.make({ userId }));
      deepStrictEqual([...result.roles], ["super_admin"]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
