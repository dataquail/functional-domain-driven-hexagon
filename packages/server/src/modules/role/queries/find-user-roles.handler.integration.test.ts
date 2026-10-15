import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository";
import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/repositories/roles.repository-live";
import { findUserRolesHandler } from "@/modules/role/queries/find-user-roles.handler";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const TestLayer = RolesRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUser = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'member@example.com', 'USA', '1 St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

describeIntegration(
  "findUserRolesHandler (integration)",
  { layer: TestLayer, tables: ["platform.roles", "user.users"] },
  (it) => {
    it.effect("returns an empty role array for a user with none granted", () =>
      Effect.gen(function* () {
        yield* seedUser;
        const result = yield* findUserRolesHandler({ userId });
        deepStrictEqual(result.userId, userId);
        deepStrictEqual([...result.roles], []);
      }),
    );

    it.effect("returns the granted roles", () =>
      Effect.gen(function* () {
        yield* seedUser;
        const repo = yield* RolesRepository;

        const granted = Result.getOrThrow(
          RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"),
        );

        yield* repo.upsertOne(granted.roles);
        const result = yield* findUserRolesHandler({ userId });
        deepStrictEqual([...result.roles], ["super_admin"]);
      }),
    );
  },
);
