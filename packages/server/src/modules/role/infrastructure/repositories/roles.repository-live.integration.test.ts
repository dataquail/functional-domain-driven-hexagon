import { deepStrictEqual } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository";
import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/repositories/roles.repository-live";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const forUser = RolesSpecifications.forUser(userId);

// platform.roles FKs to user.users(id) — every test seeds the FK row
// via raw SQL since the role module's barrel doesn't (and shouldn't)
// re-export the user module's repository internals.
const seedUser = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

const TestLayer = RolesRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "RolesRepositoryLive (integration)",
  { layer: TestLayer, tables: ["platform.roles", "user.users"] },
  (it) => {
    describe("findOne", () => {
      it.effect("returns none when no rows exist (the empty case is the caller's)", () =>
        Effect.gen(function* () {
          yield* seedUser;
          const repo = yield* RolesRepository;
          assertNone(yield* repo.findOne(forUser));
        }),
      );
    });

    describe("save", () => {
      it.effect("persists granted roles and round-trips via findOne", () =>
        Effect.gen(function* () {
          yield* seedUser;
          const repo = yield* RolesRepository;

          const granted = Result.getOrThrow(
            RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"),
          );

          yield* repo.upsertOne(granted.roles);
          const fetched = yield* Effect.fromOption(yield* repo.findOne(forUser));
          deepStrictEqual([...fetched.roles], ["super_admin"]);
        }),
      );

      it.effect("replaces existing rows when an aggregate revokes a role", () =>
        Effect.gen(function* () {
          yield* seedUser;
          const repo = yield* RolesRepository;

          const granted = Result.getOrThrow(
            RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"),
          );

          yield* repo.upsertOne(granted.roles);
          const revoked = Result.getOrThrow(RolesRootOps.revoke(granted.roles, "super_admin"));
          yield* repo.upsertOne(revoked.roles);
          // Revoking the last role deletes every row, so there is nothing to
          // reconstitute — findOne reports none (no rows = no roles).
          assertNone(yield* repo.findOne(forUser));
        }),
      );
    });
  },
);
